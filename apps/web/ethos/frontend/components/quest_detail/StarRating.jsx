import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating, onRate, size = "w-6 h-6", readOnly = false }) {
  const handleStarClick = (clickedStar) => {
    if (readOnly) return;
    
    // If the clicked star is the same as the current rating, clear it
    if (clickedStar === rating) {
      onRate(0);
    } else {
      onRate(clickedStar);
    }
  };

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => handleStarClick(star)}
          className={`${size} transition-colors ${
            star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'
          } ${!readOnly ? 'hover:text-yellow-400' : 'cursor-default'}`}
        >
          <Star className="w-full h-full" />
        </button>
      ))}
    </div>
  );
}