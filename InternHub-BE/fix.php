        // Handle Foto KTM Upload
        if ($request->hasFile('foto_ktm')) {
            $file = $request->file('foto_ktm');
            if ($mahasiswa->foto_ktm && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->foto_ktm))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto_ktm));
            }
            if ($mahasiswa->foto_ktm && str_starts_with($mahasiswa->foto_ktm, 'encrypted/')) {
                Storage::disk('local')->delete($mahasiswa->foto_ktm);
            }
            $filename = time() . '_ktm_' . uniqid() . '.enc';
            $fileContents = file_get_contents($file->getRealPath());
            $encryptedContents = Crypt::encryptString($fileContents);
            Storage::disk('local')->put('encrypted/users/' . $filename, $encryptedContents);
            $updateData['foto_ktm'] = 'encrypted/users/' . $filename;
        }

        // Handle remove foto KTM
        if ($request->boolean('remove_foto_ktm') && !$request->hasFile('foto_ktm')) {
            if ($mahasiswa->foto_ktm && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->foto_ktm))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto_ktm));
            }
            $updateData['foto_ktm'] = null;
        }

        // Handle regular profile photo upload
        if ($request->hasFile('foto')) {
            $file = $request->file('foto');
            if ($mahasiswa->foto && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->foto))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto));
            }
            if ($mahasiswa->foto && str_starts_with($mahasiswa->foto, 'encrypted/')) {
                Storage::disk('local')->delete($mahasiswa->foto);
            }
            $filename = time() . '_foto_' . uniqid() . '.enc';
            $fileContents = file_get_contents($file->getRealPath());
            $encryptedContents = Crypt::encryptString($fileContents);
            Storage::disk('local')->put('encrypted/users/' . $filename, $encryptedContents);
            $updateData['foto'] = 'encrypted/users/' . $filename;
        }

        // Handle remove profile photo
        if ($request->boolean('remove_foto') && !$request->hasFile('foto')) {
            if ($mahasiswa->foto && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->foto))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->foto));
            }
            $updateData['foto'] = null;
        }

        // Handle Bank Proof Upload
        if ($request->hasFile('bank_proof')) {
            $file = $request->file('bank_proof');
            if ($mahasiswa->bank_proof && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->bank_proof))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->bank_proof));
            }
            if ($mahasiswa->bank_proof && str_starts_with($mahasiswa->bank_proof, 'encrypted/')) {
                Storage::disk('local')->delete($mahasiswa->bank_proof);
            }
            $filename = time() . '_bank_proof_' . uniqid() . '.enc';
            $fileContents = file_get_contents($file->getRealPath());
            $encryptedContents = Crypt::encryptString($fileContents);
            Storage::disk('local')->put('encrypted/users/' . $filename, $encryptedContents);
            $updateData['bank_proof'] = 'encrypted/users/' . $filename;
        }

        // Handle remove bank proof
        if ($request->boolean('remove_bank_proof') && !$request->hasFile('bank_proof')) {
            if ($mahasiswa->bank_proof && Storage::exists(str_replace('storage/', 'public/', $mahasiswa->bank_proof))) {
                Storage::delete(str_replace('storage/', 'public/', $mahasiswa->bank_proof));
            }
            $updateData['bank_proof'] = null;
        }
