import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { fetchEvidenceObjectUrl } from './api';

type EvidenceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { path: string };

// Shows a protected evidence image: the file is fetched with the session header, then displayed from memory.
export function EvidenceImage({ path, alt, ...rest }: EvidenceImageProps) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setSrc(undefined);
    fetchEvidenceObjectUrl(path, controller.signal)
      .then((url) => {
        objectUrl = url;
        if (controller.signal.aborted) URL.revokeObjectURL(url);
        else setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return <img src={src} alt={alt} {...rest} />;
}
