# Certificate Template Management API

## Endpoints

### 1. GET /api/admin/sertifikat/templates
**Get all certificate templates (front & back)**

**Request Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Response 200 (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Sertifikat Internship - Depan",
      "side": "front",
      "image_path": "certificates/front_1707648000.png",
      "created_by": 1,
      "updated_by": 1,
      "created_at": "2026-02-10T12:00:00Z",
      "updated_at": "2026-02-10T12:00:00Z"
    },
    {
      "id": 2,
      "name": "Sertifikat Internship - Belakang",
      "side": "back",
      "image_path": "certificates/back_1707648001.png",
      "created_by": 1,
      "updated_by": 1,
      "created_at": "2026-02-10T12:01:00Z",
      "updated_at": "2026-02-10T12:01:00Z"
    }
  ]
}
```

**Response 403 (Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

### 2. POST /api/admin/sertifikat/templates
**Upload new certificate template**

**Request Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request Body (form-data):**
- `name` (string, required): Nama template. Contoh: "Sertifikat Internship - Depan"
- `side` (string, required): "front" atau "back"
- `image` (file, required): PNG file, max 10MB

**Example curl:**
```bash
curl -X POST http://localhost:8000/api/admin/sertifikat/templates \
  -H "Authorization: Bearer {token}" \
  -F "name=Sertifikat Internship Depan" \
  -F "side=front" \
  -F "image=@/path/to/depan.png"
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Template uploaded successfully",
  "data": {
    "id": 1,
    "name": "Sertifikat Internship Depan",
    "side": "front",
    "image_path": "certificates/front_1707648000.png",
    "created_by": 1,
    "updated_by": 1,
    "created_at": "2026-02-10T12:00:00Z",
    "updated_at": "2026-02-10T12:00:00Z"
  }
}
```

**Response 422 (Validation Error):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "image": ["The image field is required."],
    "side": ["The selected side is invalid."]
  }
}
```

**Response 403 (Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

### 3. GET /api/admin/sertifikat/templates/view/{side}
**View template image (returns actual image file)**

**Request Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
- `side` (string): "front" atau "back"

**Example:**
```
GET /api/admin/sertifikat/templates/view/front
```

**Response 200 (Success):**
- Returns image file (PNG format) with proper `Content-Type: image/png` header
- Browser will display image or prompt download

**Response 404 (Not Found):**
```json
{
  "success": false,
  "message": "Template not found"
}
```

**Response 403 (Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

### 4. DELETE /api/admin/sertifikat/templates/{id}
**Delete certificate template**

**Request Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**URL Parameters:**
- `id` (integer): Template ID

**Example:**
```
DELETE /api/admin/sertifikat/templates/1
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "message": "Template not found"
}
```

**Response 403 (Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

---

## Frontend Implementation Example (React)

### Get All Templates
```javascript
// src/services/certificateTemplateService.js

const getTemplates = async () => {
  const response = await fetch('/api/admin/sertifikat/templates', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data.data; // Array of templates
};

const uploadTemplate = async (name, side, imageFile) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('side', side); // 'front' or 'back'
  formData.append('image', imageFile);

  const response = await fetch('/api/admin/sertifikat/templates', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
      // Note: DO NOT set Content-Type header for FormData
    },
    body: formData
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data.data; // New template object
};

const viewTemplate = async (side) => {
  const response = await fetch(`/api/admin/sertifikat/templates/view/${side}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch template');
  return response.blob(); // Image blob for preview
};

const deleteTemplate = async (id) => {
  const response = await fetch(`/api/admin/sertifikat/templates/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
};

export { getTemplates, uploadTemplate, viewTemplate, deleteTemplate };
```

### React Component Usage
```javascript
import { useState, useEffect } from 'react';
import { getTemplates, uploadTemplate, viewTemplate, deleteTemplate } from './services/certificateTemplateService';

function CertificateTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
      
      // Load previews
      const front = data.find(t => t.side === 'front');
      const back = data.find(t => t.side === 'back');
      
      if (front) {
        const blob = await viewTemplate('front');
        setFrontPreview(URL.createObjectURL(blob));
      }
      if (back) {
        const blob = await viewTemplate('back');
        setBackPreview(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const { name, value, files } = e.target;
    if (name === 'image' && files[0]) {
      const side = e.target.dataset.side; // 'front' or 'back'
      try {
        await uploadTemplate(`Sertifikat ${side}`, side, files[0]);
        alert('Template uploaded successfully!');
        await loadTemplates();
      } catch (error) {
        alert(error.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(id);
        alert('Template deleted successfully!');
        await loadTemplates();
      } catch (error) {
        alert(error.message);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="certificate-manager">
      <h2>Certificate Template Manager</h2>
      
      <div className="template-upload">
        <div className="upload-section">
          <h3>Front Template</h3>
          {frontPreview && <img src={frontPreview} alt="Front" style={{ maxWidth: '300px' }} />}
          <input 
            type="file" 
            accept="image/png" 
            data-side="front"
            name="image"
            onChange={handleUpload}
          />
        </div>
        
        <div className="upload-section">
          <h3>Back Template</h3>
          {backPreview && <img src={backPreview} alt="Back" style={{ maxWidth: '300px' }} />}
          <input 
            type="file" 
            accept="image/png" 
            data-side="back"
            name="image"
            onChange={handleUpload}
          />
        </div>
      </div>

      <div className="templates-list">
        <h3>Current Templates</h3>
        {templates.map(template => (
          <div key={template.id} className="template-item">
            <p><strong>{template.name}</strong> ({template.side})</p>
            <button onClick={() => handleDelete(template.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CertificateTemplateManager;
```

---

## Notes

1. **Authentication**: All endpoints require valid Sanctum token
2. **Authorization**: All endpoints require admin role
3. **File Size**: Max 10MB per PNG file
4. **Side Values**: Only "front" and "back" are valid
5. **Image Format**: Only PNG files allowed
6. **Overwrite**: Using same `side` in upload will overwrite existing template
7. **Storage**: Files stored in `storage/app/public/certificates/`
