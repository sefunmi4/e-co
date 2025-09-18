
import React, { useState, useEffect, useCallback } from 'react';
import { Quest } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Eye, ArrowRight, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

const MyRequestCard = ({ quest, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="creator-card p-4 flex flex-col justify-between h-full group hover:shadow-lg transition-shadow"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
            {quest.request_type === 'team_help' ? (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 border text-xs dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700">
                    <Users className="w-3 h-3" />
                    Team Wanted
                </Badge>
            ) : (
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1 border text-xs dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700">
                    <Eye className="w-3 h-3" />
                    Feedback Wanted
                </Badge>
            )}
             {quest.status === 'completed' && (
                <Badge variant="outline" className="text-xs border-green-300 bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700">
                    Completed
                </Badge>
            )}
        </div>
        <Link 
            to={createPageUrl("QuestDetail") + "?id=" + quest.id}
            className="block"
        >
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {quest.title}
            </h3>
        </Link>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
            {quest.description}
        </p>
      </div>

      <Link to={createPageUrl("QuestDetail") + "?id=" + quest.id} className="mt-4">
        <Button 
            size="sm"
            variant="outline"
            className="w-full border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
            View Details
            <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </motion.div>
  );
};

export default function MyRequests({ currentUser, isLoading: initialLoading }) {
  const [myRequests, setMyRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMyRequests = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch quests created by the user
      const createdQuests = await Quest.filter({ 
          created_by: currentUser.email,
          request_type: { $ne: 'none' },
          is_archived: false 
      });

      // Fetch quests where the user is a collaborator
      const joinedQuests = await Quest.filter({ 
          collaborators: { $in: [currentUser.email] },
          request_type: { $ne: 'none' },
          is_archived: false 
      });

      // Combine and deduplicate
      const allRequests = [...createdQuests, ...joinedQuests];
      const requestMap = new Map();
      allRequests.forEach(q => requestMap.set(q.id, q));
      
      const uniqueRequests = Array.from(requestMap.values())
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      
      setMyRequests(uniqueRequests);
    } catch (error) {
      console.error("Error loading 'My Requests':", error);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadMyRequests();
  }, [loadMyRequests]);


  if (isLoading || initialLoading) {
    return (
      <div className="creator-card p-6">
        <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (myRequests.length === 0) {
    return null; // Don't show the component if there are no active requests
  }

  return (
    <div className="creator-card p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
        <Star className="text-yellow-500" />
        My Requests ({myRequests.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myRequests.map((quest, index) => (
          <MyRequestCard key={quest.id} quest={quest} index={index} />
        ))}
      </div>
    </div>
  );
}
