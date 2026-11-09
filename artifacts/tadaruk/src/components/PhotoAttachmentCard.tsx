import { Camera, CheckCircle2, X } from 'lucide-react';

type PhotoAttachmentCardProps = {
  imageUrl: string;
  lang: 'ar' | 'en';
  onRemove?: () => void;
  variant?: 'compact' | 'detail';
  localOnly?: boolean;
};

export default function PhotoAttachmentCard({
  imageUrl,
  lang,
  onRemove,
  variant = 'compact',
  localOnly = false,
}: PhotoAttachmentCardProps) {
  const isArabic = lang === 'ar';

  return (
    <article
      className={`photo-attachment-card${variant === 'detail' ? ' photo-attachment-card--detail' : ''}`}
      aria-label={isArabic ? 'صورة البلاغ' : 'Report photo'}
    >
      <div className="photo-attachment-thumbnail">
        <img
          src={imageUrl}
          alt={isArabic ? 'معاينة صورة البلاغ' : 'Report photo preview'}
          loading="lazy"
        />
      </div>
      <div className="photo-attachment-copy">
        <span className="photo-attachment-label">
          <Camera size={14} aria-hidden="true" />
          {isArabic ? 'مرفق صورة' : 'Photo attachment'}
        </span>
        <strong>{isArabic ? 'صورة المشكلة' : 'Issue photo'}</strong>
        {localOnly && !onRemove && <span className="photo-attachment-meta">
          {isArabic ? 'متاحة على هذا الجهاز فقط' : 'Available on this device only'}
        </span>}
        {onRemove && <span className="photo-attachment-meta">
          {isArabic ? 'جاهزة للإرسال' : 'Ready to send'}
        </span>}
      </div>
      {onRemove ? (
        <button
          className="photo-attachment-remove"
          type="button"
          onClick={onRemove}
          aria-label={isArabic ? 'إزالة صورة البلاغ' : 'Remove report photo'}
        >
          <X size={16} aria-hidden="true" />
        </button>
      ) : !localOnly ? (
        <span className="photo-attachment-state">
          <CheckCircle2 size={15} aria-hidden="true" />
          {isArabic ? 'مرفقة' : 'Attached'}
        </span>
      ) : null}
    </article>
  );
}
