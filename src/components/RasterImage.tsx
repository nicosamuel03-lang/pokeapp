import {
  useEffect,
  useMemo,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from "react";
import { getLocalWebpCandidate } from "../utils/localImageWebp";

export type RasterImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

/**
 * Image raster : lazy-load par défaut, `decoding="async"`, et tentative WebP locale
 * (`/images/...`) avec repli automatique sur l’URL d’origine si le .webp n’existe pas.
 */
export function RasterImage({
  src: originalSrc,
  onError,
  loading = "lazy",
  decoding = "async",
  ...rest
}: RasterImageProps) {
  const webp = useMemo(() => getLocalWebpCandidate(originalSrc), [originalSrc]);
  const [currentSrc, setCurrentSrc] = useState(() => webp ?? originalSrc);

  useEffect(() => {
    setCurrentSrc(webp ?? originalSrc);
  }, [webp, originalSrc]);

  const handleError = (e: SyntheticEvent<HTMLImageElement, Event>) => {
    if (webp != null && currentSrc === webp) {
      setCurrentSrc(originalSrc);
      return;
    }
    onError?.(e);
  };

  return (
    <img
      {...rest}
      src={currentSrc}
      loading={loading}
      decoding={decoding}
      onError={handleError}
    />
  );
}
