import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon } from "lucide-react";
import StarRating from "./StarRating";
import { formatDistanceToNow } from "date-fns";

export default function CommentCard({ comment }) {
  return (
    <Card className="bg-gray-50/50 dark:bg-gray-800/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{comment.user_email.split('@')[0]}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(comment.created_date))} ago</p>
              </div>
              <div className="flex items-center gap-2">
                {comment.rating && (
                  <StarRating rating={comment.rating} readOnly={true} size="w-4 h-4" />
                )}
                {comment.rating_categories && comment.rating_categories.length > 0 && (
                  <div className="flex gap-1">
                    {comment.rating_categories.map(category => (
                      <Badge key={category} variant="outline" className="text-xs capitalize dark:border-gray-600 dark:text-gray-300">
                        {category}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{comment.comment_text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}