window.getImageNaturalSize = (img) => {
  if (!img) return { width: 1920, height: 1080 };
  return { width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 };
};
