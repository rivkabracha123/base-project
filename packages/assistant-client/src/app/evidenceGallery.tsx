import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  deleteEvidence,
  evidenceUrl,
  getProfileEvidence,
  saveProfileEvidenceOrder,
  uploadItemEvidence,
  type EvidenceReference,
} from './api';

const maxFiles = 10;
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

type MoveRequest = {
  itemId: string;
  fromIndex: number;
  toIndex: number;
};

type UploadRequest = {
  itemId: string;
  files: File[];
};

type PhotoActionsMenuProps = {
  photo: EvidenceReference;
  downloadLabel: string;
  deleteLabel: string;
  menuLabel: string;
  confirmDelete: string;
  disabled: boolean;
  onDelete: (fileId: string) => void;
};

function PhotoActionsMenu({
  photo,
  downloadLabel,
  deleteLabel,
  menuLabel,
  confirmDelete,
  disabled,
  onDelete,
}: PhotoActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="absolute end-2 top-2 z-10">
      <button
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        title={menuLabel}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-black/60 p-2 text-white hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1 min-w-32 rounded-sm border border-slate-300 bg-white p-1 shadow-md"
        >

          <a
            role="menuitem"
            href={evidenceUrl(photo.downloadUri)}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
          >
            {downloadLabel}
          </a>

          <button
            role="menuitem"
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              if (window.confirm(confirmDelete)) onDelete(photo.fileId);
            }}
            className="block w-full px-3 py-2 text-start text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function EvidenceGallery({ profileId }: { profileId: string }) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const isHebrew = i18n.language.startsWith('he');
  const queryKey = ['evidence-gallery', profileId];

  const [pendingUpload, setPendingUpload] = useState<UploadRequest>();
  const [fileError, setFileError] = useState('');
  const [draggedPhotoId, setDraggedPhotoId] = useState<string>();
  const [dropTargetId, setDropTargetId] = useState<string>();
  const [selectedPhoto, setSelectedPhoto] = useState<EvidenceReference>();

  const text = isHebrew
    ? {
        title: 'גלריית התמונות',
        chooseFiles: 'בחירת תמונות לפריט חדש',
        uploading: 'מעלה תמונות…',
        loading: 'טוען תמונות…',
        error: 'לא ניתן לטעון את התמונות.',
        retry: 'ניסיון חוזר',
        empty: 'עדיין אין תמונות בפרופיל הזה.',
        download: 'הורדה',
        delete: 'מחיקה',
        moreActions: 'פעולות נוספות',
        confirmDelete: 'למחוק את התמונה?',
        showName: 'לחצי להצגת שם התמונה',
        drag: 'גרירת התמונה לסידור. אפשר גם להשתמש בחצים למעלה ולמטה.',
        invalidFiles: 'בחרי עד 10 תמונות JPEG, PNG או WebP, עד 10 MiB לתמונה.',
        uploadError: 'העלאת התמונות נכשלה.',
        uploaded: 'התמונות נוספו לגלריה.',
      }
    : {
        title: 'Photo gallery',
        chooseFiles: 'Choose photos for a new item',
        uploading: 'Uploading photos…',
        loading: 'Loading photos…',
        error: 'Photos could not be loaded.',
        retry: 'Try again',
        empty: 'There are no photos in this profile yet.',
        download: 'Download',
        delete: 'Delete',
        moreActions: 'More actions',
        confirmDelete: 'Delete this photo?',
        showName: 'Click to show the photo name',
        drag: 'Drag the photo to reorder. You can also use the up and down arrow keys.',
        invalidFiles: 'Choose up to 10 JPEG, PNG, or WebP photos, each no larger than 10 MiB.',
        uploadError: 'Photo upload failed.',
        uploaded: 'Photos were added to the gallery.',
      };

  const evidenceQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getProfileEvidence(profileId, signal),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ itemId, files }: UploadRequest) =>
      uploadItemEvidence(profileId, itemId, files),
    onSuccess: async () => {
      setPendingUpload(undefined);
      setFileError('');
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteEvidence(profileId, fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ itemId, fromIndex, toIndex }: MoveRequest) => {
      const current = evidenceQuery.data ?? [];
      const group = current.filter((photo) => photo.itemId === itemId);

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= group.length ||
        toIndex >= group.length
      ) {
        return current;
      }

      const reorderedGroup = [...group];
      const [movedPhoto] = reorderedGroup.splice(fromIndex, 1);

      if (!movedPhoto) return current;

      reorderedGroup.splice(toIndex, 0, movedPhoto);

      let groupIndex = 0;
      const reorderedProfile = current.map((photo) =>
        photo.itemId === itemId ? reorderedGroup[groupIndex++]! : photo,
      );

      return saveProfileEvidenceOrder(
        profileId,
        reorderedProfile.map((photo) => photo.fileId),
      );
    },
    onSuccess: (orderedEvidence) => {
      queryClient.setQueryData(queryKey, orderedEvidence);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';

    const valid =
      files.length > 0 &&
      files.length <= maxFiles &&
      files.every(
        (file) =>
          allowedTypes.includes(file.type) && file.size <= maxFileSize,
      );

    uploadMutation.reset();

    if (!valid) {
      setPendingUpload(undefined);
      setFileError(text.invalidFiles);
      return;
    }

    const request = {
      itemId: `gallery-${crypto.randomUUID()}`,
      files,
    };

    setPendingUpload(request);
    setFileError('');
    uploadMutation.mutate(request);
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    fileId: string,
  ) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', fileId);
    setDraggedPhotoId(fileId);
  }

  function handleDrop(
    event: DragEvent<HTMLLIElement>,
    itemId: string,
    toIndex: number,
  ) {
    event.preventDefault();

    const fileId =
      event.dataTransfer.getData('text/plain') || draggedPhotoId;
    const group = (evidenceQuery.data ?? []).filter(
      (photo) => photo.itemId === itemId,
    );
    const fromIndex = group.findIndex((photo) => photo.fileId === fileId);

    if (fromIndex >= 0 && fromIndex !== toIndex) {
      moveMutation.mutate({ itemId, fromIndex, toIndex });
    }

    setDraggedPhotoId(undefined);
    setDropTargetId(undefined);
  }

  function handlePhotoKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    itemId: string,
    index: number,
    groupLength: number,
  ) {
    const toIndex =
      event.key === 'ArrowUp' && index > 0
        ? index - 1
        : event.key === 'ArrowDown' && index < groupLength - 1
          ? index + 1
          : undefined;

    if (toIndex !== undefined) {
      event.preventDefault();
      moveMutation.mutate({ itemId, fromIndex: index, toIndex });
    }
  }

  const groups = new Map<string, EvidenceReference[]>();

  for (const photo of evidenceQuery.data ?? []) {
    const group = groups.get(photo.itemId) ?? [];
    group.push(photo);
    groups.set(photo.itemId, group);
  }

  return (
    <main
      dir={isHebrew ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#f6f1e7] px-4 py-8 sm:px-6"
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-slate-950">
          {text.title}
        </h1>

        <section className="mb-6 space-y-3 border-b border-slate-400/30 pb-5">
          <label className="inline-flex cursor-pointer rounded-md border border-slate-400 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-white/50">
            {text.chooseFiles}
            <input
              className="sr-only"
              type="file"
              accept={allowedTypes.join(',')}
              multiple
              disabled={uploadMutation.isPending}
              onChange={handleFileSelection}
            />
          </label>

          {pendingUpload && uploadMutation.isPending && (
            <p role="status">
              {text.uploading}: {pendingUpload.files.map((file) => file.name).join(', ')}
            </p>
          )}

          {fileError && <p role="alert">{fileError}</p>}

          {uploadMutation.isError && (
            <div role="alert">
              <p>{uploadMutation.error.message || text.uploadError}</p>
              {pendingUpload && (
                <button
                  type="button"
                  onClick={() => uploadMutation.mutate(pendingUpload)}
                  className="mt-2 rounded-md border border-slate-400 px-3 py-2 text-sm"
                >
                  {text.retry}
                </button>
              )}
            </div>
          )}

          {uploadMutation.isSuccess && (
            <p role="status">{text.uploaded}</p>
          )}
        </section>

        {evidenceQuery.isPending && (
          <p role="status" className="py-4 text-slate-700">
            {text.loading}
          </p>
        )}

        {evidenceQuery.isError && (
          <div role="alert" className="space-y-3 py-4">
            <p>{evidenceQuery.error.message || text.error}</p>
            <button
              type="button"
              onClick={() => void evidenceQuery.refetch()}
              className="rounded-md border border-slate-400 px-3 py-2 text-sm hover:bg-white/50"
            >
              {text.retry}
            </button>
          </div>
        )}

        {evidenceQuery.isSuccess && groups.size === 0 && (
          <p className="py-3 text-slate-700">{text.empty}</p>
        )}

        {[...groups.entries()].map(([itemId, photos], groupIndex) => (
          <section
            key={itemId}
            aria-label={`${text.title} ${groupIndex + 1}`}
            className={
              groupIndex === 0
                ? 'py-3'
                : 'border-t border-slate-400/30 py-5'
            }
          >
            <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((photo, index) => (
                <li
                  key={photo.fileId}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDropTargetId(photo.fileId);
                  }}
                  onDrop={(event) => handleDrop(event, itemId, index)}
                  className={`group w-full max-w-44 rounded-md border border-[#d9cebe] bg-white/80 p-2 shadow-sm transition-shadow hover:shadow-md ${
                    dropTargetId === photo.fileId
                      ? 'outline outline-2 outline-slate-500'
                      : ''
                  } ${draggedPhotoId === photo.fileId ? 'opacity-40' : ''}`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-white">
                    <button
                      type="button"
                      draggable={!moveMutation.isPending}
                      onClick={() => setSelectedPhoto(photo)}
                      onDragStart={(event) => handleDragStart(event, photo.fileId)}
                      onDragEnd={() => {
                        setDraggedPhotoId(undefined);
                        setDropTargetId(undefined);
                      }}
                      onKeyDown={(event) =>
                        handlePhotoKeyDown(event, itemId, index, photos.length)
                      }
                      className="block h-full w-full cursor-grab active:cursor-grabbing"
                    >
                      <img
                        src={evidenceUrl(photo.previewUri)}
                        alt={photo.originalName}
                        className="h-full w-full object-contain p-2"
                      />
                    </button>

                    <PhotoActionsMenu
                      photo={photo}
                      downloadLabel={text.download}
                      deleteLabel={text.delete}
                      menuLabel={text.moreActions}
                      confirmDelete={text.confirmDelete}
                      disabled={deleteMutation.isPending}
                      onDelete={(fileId) => deleteMutation.mutate(fileId)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {moveMutation.isError && (
          <p role="alert" className="py-3 text-sm text-red-800">
            {moveMutation.error.message}
          </p>
        )}

        {deleteMutation.isError && (
          <p role="alert" className="py-3 text-sm text-red-800">
            {deleteMutation.error.message}
          </p>
        )}
      </div>
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPhoto(undefined);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selectedPhoto.originalName}
            className="relative max-h-full max-w-5xl rounded-md bg-white p-4"
          >
            <button
              type="button"
              aria-label={isHebrew ? 'סגירה' : 'Close'}
              onClick={() => setSelectedPhoto(undefined)}
              className="absolute end-2 top-2 z-10 rounded bg-white/90 px-3 py-1 text-xl"
            >
              ×
            </button>

            <img
              src={evidenceUrl(selectedPhoto.previewUri)}
              alt={selectedPhoto.originalName}
              className="max-h-[80vh] max-w-full object-contain"
            />

            <p className="mt-3 text-sm text-slate-800">
              {selectedPhoto.originalName}
            </p>
          </section>
        </div>
      )}
    </main>
  );
}