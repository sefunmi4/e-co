import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import StarRating from "./StarRating";

export default function CommentForm({ quest, onCommentPosted, areReviewsAllowed }) {
  const [commentText, setCommentText] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingCategory, setRatingCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const isDiscussion = quest.quest_type === 'discussion';

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    setFeedback("");

    const commentData = {
      comment_text: commentText,
    };

    // Only add rating info if reviews are allowed and a rating was given
    if (areReviewsAllowed && rating > 0) {
      commentData.rating = rating;
      if (ratingCategory) {
        commentData.rating_categories = [ratingCategory];
      }
    }

    try {
      await onCommentPosted(commentData);
      setCommentText("");
      setRating(0);
      setRatingCategory("");
      setFeedback("Comment posted!");
    } catch {
      setFeedback("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-700">
      {/* Review Section - Conditionally Rendered */}
      {areReviewsAllowed && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {isDiscussion ? "Leave a Review" : "Add a Review"}
          </h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Rating</label>
              <StarRating rating={rating} onRate={setRating} />
            </div>
            
            {rating > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rating Category</label>
                <RadioGroup
                  value={ratingCategory}
                  onValueChange={setRatingCategory}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="impact" id="r-impact" className="dark:bg-gray-800 dark:border-gray-600" />
                    <label htmlFor="r-impact" className="text-sm text-gray-600 dark:text-gray-400">
                      {isDiscussion ? "Thoughtfulness" : "Impact"}
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quality" id="r-quality" className="dark:bg-gray-800 dark:border-gray-600" />
                    <label htmlFor="r-quality" className="text-sm text-gray-600 dark:text-gray-400">Quality</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="difficulty" id="r-difficulty" className="dark:bg-gray-800 dark:border-gray-600" />
                    <label htmlFor="r-difficulty" className="text-sm text-gray-600 dark:text-gray-400">
                      {isDiscussion ? "Originality" : "Difficulty"}
                    </label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comment Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {areReviewsAllowed ? "Add Your Comment" : "Join the Discussion"}
        </h3>
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={
            areReviewsAllowed
              ? "Share your feedback and suggestions..."
              : "Leave a comment..."
          }
          rows={4}
          className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
        />
        <div className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !commentText.trim()}
            className="creator-btn"
          >
            {isSubmitting ? "Posting..." : areReviewsAllowed && rating > 0 ? "Post Review" : "Post Comment"}
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        {!areReviewsAllowed && (
          "The author is not currently requesting reviews. You can only leave comments."
        )}
        {areReviewsAllowed && (
          "Reviews and ratings are enabled for this post."
        )}
      </div>
      {feedback && <p className="text-sm text-gray-600 dark:text-gray-300">{feedback}</p>}
    </div>
  );
}