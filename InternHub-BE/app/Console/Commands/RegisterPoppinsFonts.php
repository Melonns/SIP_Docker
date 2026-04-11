<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Dompdf\Dompdf;

class RegisterPoppinsFonts extends Command
{
    protected $signature = 'cert:register-poppins';
    protected $description = 'Register Poppins fonts with DomPDF (generate UFM files). Run once after deploying fonts to storage/fonts.';

    public function handle()
    {
        $this->info('Registering Poppins fonts...');

        $dompdf = new Dompdf();
        // Ensure Dompdf uses storage/fonts for font installs
        $dompdf->setOptions(new \Dompdf\Options(['fontDir' => storage_path('fonts'), 'fontCache' => storage_path('fonts'), 'isRemoteEnabled' => true]));
        $options = $dompdf->getOptions();
        $fontDir = storage_path('fonts');

        if (!is_dir($fontDir)) {
            $this->error("Font directory not found: $fontDir");
            return 1;
        }

        // Normalize installed-fonts.json entries to absolute paths to avoid "undefined array key" errors
        $installedFile = $fontDir . '/installed-fonts.json';
        if (is_readable($installedFile)) {
            try {
                $data = json_decode(file_get_contents($installedFile), true);
                $changed = false;
                if (is_array($data)) {
                    foreach ($data as $family => &$variants) {
                        foreach ($variants as $variant => &$value) {
                            if (!is_string($value)) continue;
                            // Normalize backslashes and forward slashes first
                            $value = str_replace('\\', '/', $value);
                            // Remove accidental duplicate fontDir prefix
                            $value = str_replace($fontDir . '/' . $fontDir . '/', $fontDir . '/', $value);
                            // If value doesn't look like absolute path (Windows drive letter or leading slash), prefix fontDir
                            if (!preg_match('#^[A-Za-z]:/|^/#', $value)) {
                                $value = $fontDir . '/' . ltrim($value, '\\/');
                                $changed = true;
                            }
                        }
                    }
                    if ($changed) {
                        file_put_contents($installedFile, json_encode($data, JSON_PRETTY_PRINT));
                        $this->line('Normalized installed-fonts.json entries to absolute paths.');
                    }
                }
            } catch (\Throwable $e) {
                $this->line('Could not normalize installed-fonts.json: ' . $e->getMessage());
            }
        }

        $variants = [
            300 => $fontDir . '/Poppins-300.ttf',
            400 => $fontDir . '/Poppins-400.ttf',
            600 => $fontDir . '/Poppins-600.ttf',
            700 => $fontDir . '/Poppins-700.ttf',
            800 => $fontDir . '/Poppins-800.ttf',
        ];

        // Rebuild poppinslocal entries in installed-fonts.json if they look malformed
        try {
            $poppinsFiles = glob($fontDir . '/poppinslocal_*');
            if (!empty($poppinsFiles)) {
                $new = [];
                foreach ($poppinsFiles as $f) {
                    $name = basename($f);
                    if (preg_match('/poppinslocal_(\d+)_([a-f0-9]+)/', $name, $m)) {
                        $base = preg_replace('/(\.ufm(\.json)?|\.ttf)$/i', '', $name);
                        $new[$m[1]] = $base;
                    } elseif (strpos($name, 'poppinslocal_normal') !== false) {
                        $base = preg_replace('/(\.ufm(\.json)?|\.ttf)$/i', '', $name);
                        $new['normal'] = $base;
                    } elseif (strpos($name, 'poppinslocal_bold') !== false) {
                        $base = preg_replace('/(\.ufm(\.json)?|\.ttf)$/i', '', $name);
                        $new['bold'] = $base;
                    }
                }
                if (!empty($new)) {
                    $data['poppinslocal'] = $new;
                    file_put_contents($installedFile, json_encode($data, JSON_PRETTY_PRINT));
                    $this->line('Rebuilt poppinslocal entries in installed-fonts.json');
                }
            }
        } catch (\Throwable $e) {
            $this->line('Could not rebuild poppinslocal entries: ' . $e->getMessage());
        }

        // Additional pass: pick newest poppinslocal_* candidates (fallback to newest files)
        try {
            $poppinsFiles = glob($fontDir . '/poppinslocal_*');
            $candidates = [];
            foreach ($poppinsFiles as $f) {
                $name = basename($f);
                $base = preg_replace('/(\.ufm(\.json)?|\.ttf)$/i', '', $name);
                if (preg_match('/^poppinslocal_(?<key>[0-9]+|normal|bold)_/i', $base, $m)) {
                    $key = $m['key'];
                    $mtime = filemtime($f);
                    if (!isset($candidates[$key]) || $mtime > $candidates[$key]['mtime']) {
                        $candidates[$key] = ['base' => $base, 'mtime' => $mtime];
                    }
                }
            }
            if (!empty($candidates)) {
                $new = [];
                foreach ($candidates as $k => $info) {
                    $new[$k] = $info['base'];
                }
                $data['poppinslocal'] = $new;
                file_put_contents($installedFile, json_encode($data, JSON_PRETTY_PRINT));
                $this->line('Rebuilt poppinslocal entries in installed-fonts.json (newest candidates)');
            }
        } catch (\Throwable $e) {
            $this->line('Additional rebuild pass failed: ' . $e->getMessage());
        }

        // Ensure Dompdf chroot includes the fonts directory so validateLocalUri() succeeds
        try {
            $rootDir = realpath(base_path());
            $fontDirReal = realpath($fontDir);
            $options->setChroot([$rootDir, $fontDirReal]);
            $this->line("Set dompdf chroot to project root and fonts dir.");
        } catch (\Throwable $e) {
            $this->line('Could not set dompdf chroot: ' . $e->getMessage());
        }

        // Pre-convert any available Poppins TTFs into dompdf font files and update installed-fonts.json
        try {
            $poppinsTtfs = glob($fontDir . '/Poppins-*.ttf');
            $created = 0;
            foreach ($poppinsTtfs as $ttfPath) {
                $base = basename($ttfPath);
                if (!preg_match('/Poppins-(\d+)\.ttf/i', $base, $m)) continue;
                $weightKey = ($m[1] == '400') ? 'normal' : $m[1];
                $hash = md5_file($ttfPath);
                $localBase = "poppinslocal_{$weightKey}_{$hash}";
                $ufmPath = $fontDir . '/' . $localBase . '.ufm';
                $localTtf = $fontDir . '/' . $localBase . '.ttf';

                if (!file_exists($ufmPath) || !file_exists($localTtf)) {
                    try {
                        $font = \FontLib\Font::load($ttfPath);
                        if ($font) {
                            $font->parse();
                            $font->saveAdobeFontMetrics($ufmPath);
                            $font->close();
                            copy($ttfPath, $localTtf);
                            $this->line("Created: $localBase (ufm + ttf)");
                            $created++;
                        }
                    } catch (\Throwable $e) {
                        $this->line("Conversion failed for $ttfPath: " . $e->getMessage());
                    }
                }

                // Update installed-fonts.json mapping
                $installed = is_readable($installedFile) ? json_decode(file_get_contents($installedFile), true) : [];
                if (!isset($installed['poppinslocal']) || !is_array($installed['poppinslocal'])) {
                    $installed['poppinslocal'] = [];
                }
                if (!isset($installed['poppinslocal'][$weightKey])) {
                    $installed['poppinslocal'][$weightKey] = $localBase;
                    file_put_contents($installedFile, json_encode($installed, JSON_PRETTY_PRINT));
                    $this->line("Updated installed-fonts.json: poppinslocal.$weightKey = $localBase");
                }
            }
            if ($created > 0) $this->line("Pre-converted $created Poppins font(s) to dompdf format.");
        } catch (\Throwable $e) {
            $this->line('Pre-conversion step failed: ' . $e->getMessage());
        }

        $fontMetrics = $dompdf->getFontMetrics();

        // Use installed-fonts.json mapping instead of registerFont() to avoid uri/chroot validation
        $registered = 0;
        try {
            $installed = is_readable($installedFile) ? json_decode(file_get_contents($installedFile), true) : [];
            $poppinsMap = isset($installed['poppinslocal']) && is_array($installed['poppinslocal']) ? $installed['poppinslocal'] : [];
            if (!empty($poppinsMap)) {
                $fontMetrics->setFontFamily('PoppinsLocal', $poppinsMap);
                $this->line('Set PoppinsLocal family from installed-fonts.json with variants: ' . implode(', ', array_keys($poppinsMap)));
                $registered = count($poppinsMap);
            } else {
                $this->line('No poppinslocal entries found in installed-fonts.json to set.');
            }
        } catch (\Throwable $e) {
            $this->line('Could not set PoppinsLocal family from installed-fonts.json: ' . $e->getMessage());
        }

        $this->info("Finished. Registered: $registered fonts.");

        // Dump any dompdf warnings captured during registration
        global $_dompdf_warnings;
        if (!empty($_dompdf_warnings)) {
            $this->line("Dompdf warnings captured:");
            foreach ($_dompdf_warnings as $w) {
                $this->line(" - $w");
            }
        }

        return 0;
    }
}
