import { useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Video } from "../api";
import { extractYouTubeId } from "../../shared/youtube";
export function YouTubeEmbed({ url, title }: { url: string; title: string }) {
  const id = extractYouTubeId(url);
  return id ? (
    <iframe
      className="youtube-embed"
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : (
    <p>URL de vídeo inválida.</p>
  );
}
export function VideoModal({
  video,
  onClose,
}: {
  video: Video;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="video-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <span>{video.category}</span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Fechar vídeo"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        <YouTubeEmbed url={video.youtubeUrl} title={video.title} />
        <div className="dialog-description">
          <h2>{video.title}</h2>
          <p>{video.description}</p>
          <a
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noreferrer"
          >
            Assistir no YouTube <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </dialog>
  );
}
