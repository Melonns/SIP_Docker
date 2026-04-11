<?php
// Quick test script for parseCertNumbersFile behavior
$path = $argv[1] ?? null;
$hasHeaderArg = $argv[2] ?? null; // '1' or '0' or omitted
if (!$path || !file_exists($path)) {
    echo "Usage: php test_parse_cert.php <path-to-csv> [hasHeader]
";
    exit(1);
}
$hasHeader = null;
if ($hasHeaderArg !== null) {
    $hasHeader = (bool) intval($hasHeaderArg);
}

function parseCertNumbersFile($path, ?bool $hasHeader = null) {
    try {
        $content = @file_get_contents($path);
        if ($content === false) return [];
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        $lines = preg_split('/\r\n|\n|\r/', $content);
        $firstLine = null;
        foreach ($lines as $line) {
            if (trim($line) !== '') { $firstLine = $line; break; }
        }
        $firstValue = trim((string) $firstLine);
        $delimiter = ',';
        if ($firstLine !== false) {
            $delims = [',', ';', "\t", '|'];
            $counts = [];
            foreach ($delims as $d) {
                $counts[$d] = substr_count($firstLine, $d);
            }
            arsort($counts);
            $delimiter = key($counts);
        }

        if (in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), ['csv', 'txt'])) {
            if ($hasHeader === null) {
                $lower = strtolower($firstValue);
                $hasHeader = $firstValue === '' || preg_match('/[a-zA-Z]/', $firstValue)
                    || str_contains($lower, 'nomor')
                    || str_contains($lower, 'number')
                    || str_contains($lower, 'cert');
            }
            $rows = [];
            $rowIndex = 0;
            foreach ($lines as $line) {
                if (trim($line) === '') continue;
                $rowIndex++;
                $data = str_getcsv($line, $delimiter);
                if (!is_array($data) || count($data) === 0) continue;
                $value = trim((string) ($data[0] ?? ''));
                if ($hasHeader && $rowIndex === 1) {
                    continue; // header row
                }
                if ($value !== '') $rows[] = $value;
            }
            return $rows;
        }

        // fallback for xlsx using phpoffice not available in this quick script
        // emulate reading from excel: treat like no header auto-detect
        if ($hasHeader === null) $hasHeader = false;
        $rows = [];
        $rowIndex = 0;
        foreach ($lines as $line) {
            if (trim($line) === '') continue;
            $rowIndex++;
            $value = trim($line);
            if ($hasHeader && $rowIndex === 1) continue;
            if ($value !== '') $rows[] = $value;
        }
        return $rows;
    } catch (Throwable $e) {
        return [];
    }
}

$rows = parseCertNumbersFile($path, $hasHeader);
echo "hasHeaderArg=".var_export($hasHeaderArg, true)."\n";
echo "detected_count=".count($rows)."\n";
foreach ($rows as $i=>$r) {
    echo ($i+1)." => ".$r."\n";
}
