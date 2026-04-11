import React, { useState, useEffect } from 'react';
import { fetchSecureBlob } from '../utils/secureFetch';

const SecureImage = ({ src, alt, className, onClick }) => {
    const [imgUrl, setImgUrl] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!src) { setImgUrl(null); setLoading(false); return; }
        let active = true;
        setLoading(true);

        // For data: and blob: URLs, use directly (no fetch needed)
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setImgUrl(src); setLoading(false); return;
        }

        // Use fetch() API instead of axios (XHR) to avoid browser logging 404s to console
        fetchSecureBlob(src)
            .then(blobUrl => { if (active) setImgUrl(blobUrl); })
            .finally(() => { if (active) setLoading(false); });

        return () => { active = false; };
    }, [src]);

    if (loading) return <div className={`bg-slate-100 animate-pulse ${className}`} />;
    if (!imgUrl) return null;
    return <img src={imgUrl} alt={alt} className={className} onClick={onClick} />;
};

export default SecureImage;
