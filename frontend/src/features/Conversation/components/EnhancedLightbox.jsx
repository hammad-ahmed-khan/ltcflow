import { useState, useEffect, useCallback } from 'react';

const EnhancedLightbox = ({ 
  images, 
  currentImage, 
  onClose, 
  buildImageUrl 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Find initial index based on currentImage
  useEffect(() => {
    const index = images.findIndex(img => img._id === currentImage._id);
    setCurrentIndex(index >= 0 ? index : 0);
  }, [currentImage, images]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, images.length]);

  const handlePrevious = useCallback(() => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setIsLoading(true);
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleThumbnailClick = useCallback((index) => {
    setIsLoading(true);
    setCurrentIndex(index);
  }, []);

  const handleDownload = useCallback(async () => {
    const currentImg = images[currentIndex];
    const imageUrl = buildImageUrl(currentImg.content, 2048);
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${currentImg._id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [currentIndex, images, buildImageUrl]);

  const currentImg = images[currentIndex];

  return (
    <div 
      className="lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Header with close and download buttons */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 20px 12px 20px',
          paddingTop: 'max(20px, env(safe-area-inset-top))',
          zIndex: 10001,
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          color: 'white', 
          fontSize: '16px',
          fontWeight: '500',
          marginTop: '8px',
        }}>
          {currentIndex + 1} / {images.length}
        </div>
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={handleDownload}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              transition: 'background 0.2s',
              WebkitTapHighlightColor: 'transparent',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
            }}
            onTouchStart={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'}
            onTouchEnd={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.4)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
            title="Download Image"
          >
            <span style={{ fontSize: '22px', lineHeight: '1' }}>↓</span>
          </button>
          
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              width: '44px',
              height: '44px',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              transition: 'background 0.2s',
              WebkitTapHighlightColor: 'transparent',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
            }}
            onTouchStart={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'}
            onTouchEnd={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.4)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
            title="Close"
          >
            <span style={{ fontSize: '28px', lineHeight: '1', fontWeight: '300' }}>×</span>
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div 
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxHeight: 'calc(100vh - 200px)',
          padding: '80px 20px 20px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Previous button */}
        {images.length > 1 && (
          <button
            onClick={handlePrevious}
            style={{
              position: 'absolute',
              left: '20px',
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              color: 'white',
              width: '50px',
              height: '50px',
              minWidth: '50px',
              minHeight: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px',
              transition: 'background 0.2s',
              zIndex: 10002,
              WebkitTapHighlightColor: 'transparent',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
            }}
            onTouchStart={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'}
            onTouchEnd={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.4)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
            title="Previous Image"
          >
            <span style={{ fontSize: '28px', lineHeight: '1', fontWeight: '300' }}>‹</span>
          </button>
        )}

        {/* Image */}
        <div style={{
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isLoading && (
            <div style={{
              position: 'absolute',
              color: 'white',
              fontSize: '18px',
            }}>
              Loading...
            </div>
          )}
          <img
            src={buildImageUrl(currentImg.content, 2048)}
            alt="Full size"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: isLoading ? 'none' : 'block',
            }}
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        </div>

        {/* Next button */}
        {images.length > 1 && (
          <button
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              color: 'white',
              width: '50px',
              height: '50px',
              minWidth: '50px',
              minHeight: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px',
              transition: 'background 0.2s',
              zIndex: 10002,
              WebkitTapHighlightColor: 'transparent',
              WebkitTransform: 'translateZ(0)',
              transform: 'translateZ(0)',
            }}
            onTouchStart={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'}
            onTouchEnd={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.4)'}
            onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.25)'}
            title="Next Image"
          >
            <span style={{ fontSize: '28px', lineHeight: '1', fontWeight: '300' }}>›</span>
          </button>
        )}
      </div>

      {/* Thumbnail strip at bottom */}
      {images.length > 1 && (
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '15px',
            overflowX: 'auto',
            overflowY: 'hidden',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            maxHeight: '140px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, index) => (
            <div
              key={img._id}
              onClick={() => handleThumbnailClick(index)}
              style={{
                minWidth: '80px',
                maxWidth: '80px',
                height: '80px',
                cursor: 'pointer',
                border: index === currentIndex ? '3px solid #007bff' : '3px solid transparent',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'all 0.2s',
                opacity: index === currentIndex ? 1 : 0.6,
                transform: index === currentIndex ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <img
                src={buildImageUrl(img.content, 256)}
                alt={`Thumbnail ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnhancedLightbox;