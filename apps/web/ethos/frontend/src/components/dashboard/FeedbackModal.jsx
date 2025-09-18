import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

const ratingAspects = [
  { key: 'quality', label: 'Overall Quality', description: 'Technical execution and craftsmanship' },
  { key: 'creativity', label: 'Creativity', description: 'Originality and innovative thinking' },
  { key: 'execution', label: 'Execution', description: 'How well the idea was implemented' },
  { key: 'presentation', label: 'Presentation', description: 'Clarity and professional presentation' }
];

export default function FeedbackModal({ quest, onClose, onSubmit }) {
  const [overallRating, setOverallRating] = useState(0);
  const [aspectRatings, setAspectRatings] = useState({
    quality: 0,
    creativity: 0,
    execution: 0,
    presentation: 0
  });
  const [feedbackText, setFeedbackText] = useState("");

  const handleAspectRating = (aspect, rating) => {
    setAspectRatings(prev => ({ ...prev, [aspect]: rating }));
    
    // Auto-calculate overall rating as average
    const newAspects = { ...aspectRatings, [aspect]: rating };
    const validRatings = Object.values(newAspects).filter(r => r > 0);
    if (validRatings.length > 0) {
      const average = validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length;
      setOverallRating(Math.round(average));
    }
  };

  const handleSubmit = () => {
    if (overallRating === 0) return;
    
    onSubmit({
      rating: overallRating,
      feedback_text: feedbackText,
      aspect_ratings: aspectRatings
    });
  };

  const StarRating = ({ rating, onRate, size = "w-6 h-6" }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => onRate(star)}
          className={`${size} transition-colors ${
            star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          } hover:text-yellow-400`}
        >
          <Star className="w-full h-full" />
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Rate & Review "{quest.title}"
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Help the creator improve by providing thoughtful feedback on their {quest.quest_type}.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Overall Rating</label>
            <div className="flex items-center gap-3">
              <StarRating 
                rating={overallRating} 
                onRate={setOverallRating}
                size="w-8 h-8"
              />
              <span className="text-sm text-gray-500">
                {overallRating > 0 ? `${overallRating}/5 stars` : 'Click to rate'}
              </span>
            </div>
          </div>

          {/* Aspect Ratings */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">Detailed Ratings</label>
            <div className="grid gap-4">
              {ratingAspects.map(aspect => (
                <div key={aspect.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{aspect.label}</div>
                    <div className="text-xs text-gray-500">{aspect.description}</div>
                  </div>
                  <StarRating 
                    rating={aspectRatings[aspect.key]} 
                    onRate={(rating) => handleAspectRating(aspect.key, rating)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Written Feedback */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">
              Written Feedback <span className="text-gray-400">(Optional)</span>
            </label>
            <Textarea
              placeholder="Share your thoughts, suggestions, or what you liked about this work..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Feedback Guidelines */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Feedback Guidelines</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Be constructive and specific in your feedback</li>
              <li>• Highlight both strengths and areas for improvement</li>
              <li>• Consider the creator's skill level and goals</li>
              <li>• Be respectful and encouraging</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={overallRating === 0}
            className="creator-btn"
          >
            Submit Feedback
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}