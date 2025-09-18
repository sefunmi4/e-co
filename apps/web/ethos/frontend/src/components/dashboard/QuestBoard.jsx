
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, UserPlus, Eye, Star, RotateCcw, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getUserDisplayName } from "../shared/UserDisplay";
import { TeamApplication, UserFollow, Party, Quest } from "@/api/entities";
import TeamApplicationModal from "./TeamApplicationModal";

const roleTypeColors = {
  creator: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  developer: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", 
  freelancer: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  explorer: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
};

const QuestBoardCard = ({ quest, index, currentUser, onTeamApplication, userApplications }) => {
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Check if user has already applied to this quest
  const existingApplication = userApplications.find(app => app.quest_id === quest.id);

  const handleTeamApplication = async (applicationData) => {
    if (!currentUser) {
      alert("You must be logged in to apply for a team.");
      return;
    }

    try {
      await TeamApplication.create({
        quest_id: quest.id,
        applicant_email: currentUser.email,
        ...applicationData
      });
      
      setShowTeamModal(false);
      alert("Application submitted successfully!");
      
      if (onTeamApplication) {
        onTeamApplication();
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Failed to submit application. Please try again.");
    }
  };

  const getApplicationStatusBadge = () => {
    if (!existingApplication) return null;
    
    const statusColors = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700",
      accepted: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
      rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
    };

    const statusText = {
      pending: "Applied",
      accepted: "Accepted", 
      rejected: "Not Selected"
    };

    return (
      <Badge className={`${statusColors[existingApplication.status]} border text-xs gap-1`}>
        <Clock className="w-3 h-3" />
        {statusText[existingApplication.status]}
      </Badge>
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="creator-card p-5 flex flex-col justify-between h-full group hover:shadow-lg transition-shadow"
      >
        <div>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {quest.request_type === 'team_help' ? (
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 border text-xs dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700">
                  <UserPlus className="w-3 h-3" />
                  Team Wanted
                </Badge>
              ) : quest.request_type === 'feedback' ? (
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 gap-1 border text-xs dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700">
                  <Eye className="w-3 h-3" />
                  Feedback Wanted
                </Badge>
              ) : null}
              
              {/* Show application status badge if user has applied */}
              {getApplicationStatusBadge()}
            </div>
            {quest.average_rating && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                <span>{quest.average_rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          <div className="mb-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              by {getUserDisplayName(quest.creator_user || quest.created_by)}
            </p>
            <Link 
              to={createPageUrl("QuestDetail") + "?id=" + quest.id}
              className="block"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                {quest.title}
              </h3>
            </Link>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
            {quest.description}
          </p>

          {quest.request_type === 'team_help' && quest.team_roles && quest.team_roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {quest.team_roles.slice(0, 2).map((role, idx) => (
                <Badge key={idx} className={`${roleTypeColors[role.role_type]} border text-xs`}>
                  {role.count} {role.role_type}{role.count > 1 ? 's' : ''}
                </Badge>
              ))}
              {quest.team_roles.length > 2 && (
                <Badge variant="outline" className="text-xs dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                  +{quest.team_roles.length - 2} more
                </Badge>
              )}
            </div>
          )}
        </div>
        
        {/* Show different buttons based on application status */}
        {quest.request_type === 'team_help' ? (
          existingApplication ? (
            // User has already applied - show status
            <div className="text-center py-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {existingApplication.status === 'pending' && "Application submitted"}
                {existingApplication.status === 'accepted' && "You're on this team!"}
                {existingApplication.status === 'rejected' && "Application not selected"}
              </p>
            </div>
          ) : (
            // User hasn't applied - show join button
            <Button 
              onClick={() => setShowTeamModal(true)}
              size="sm"
              className="w-full creator-btn"
            >
              Join Team
              <UserPlus className="w-4 h-4 ml-2" />
            </Button>
          )
        ) : (
          // Feedback requests - always show feedback button
          <Link to={createPageUrl("QuestDetail") + "?id=" + quest.id + "&action=feedback"}>
            <Button 
              size="sm"
              variant="outline"
              className="w-full border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/50 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-700"
            >
              Give Feedback
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </motion.div>

      {showTeamModal && quest.request_type === 'team_help' && !existingApplication && (
        <TeamApplicationModal
          quest={quest}
          availableRoles={quest.team_roles || []}
          onClose={() => setShowTeamModal(false)}
          onSubmit={handleTeamApplication}
        />
      )}
    </>
  );
};

export default function QuestBoard({ isLoading: initialLoading, currentUser }) {
  const [quests, setQuests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [rejectedQuestIds, setRejectedQuestIds] = useState(new Set());
  const [userApplications, setUserApplications] = useState([]);

  const loadQuestBoardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all public quests that have an active request directly
      const publicTeamRequests = await Quest.filter({
        visibility: 'public',
        request_visibility: 'public',
        request_type: 'team_help',
        status: { $in: ['open', 'in_progress'] },
        is_archived: false,
      });

      const publicFeedbackRequests = await Quest.filter({
        visibility: 'public',
        request_visibility: 'public',
        request_type: 'feedback',
        status: { $in: ['open', 'in_progress'] },
        is_archived: false,
      });
      
      let allPublicRequests = [...publicTeamRequests, ...publicFeedbackRequests];

      // If user is logged in, also fetch private requests they should see
      if (currentUser) {
        // Fetch user's applications to track their status
        const applications = await TeamApplication.filter({ 
          applicant_email: currentUser.email 
        });
        setUserApplications(applications);

        // Followers-only requests
        const followingList = await UserFollow.filter({ follower_email: currentUser.email });
        const followedEmails = followingList.map(f => f.following_email);

        if (followedEmails.length > 0) {
          const followerRequests = await Quest.filter({
            created_by: { $in: followedEmails },
            request_visibility: 'followers_only',
            status: { $in: ['open', 'in_progress'] },
            is_archived: false
          });
          allPublicRequests.push(...followerRequests);
        }

        // Party-only requests
        const userParties = await Party.filter({});
        const userPartyIds = userParties
            .filter(party => party.member_emails.includes(currentUser.email))
            .map(party => party.id);
        
        if (userPartyIds.length > 0) {
            const partyRequests = await Quest.filter({
                party_id: { $in: userPartyIds },
                request_visibility: 'party_only',
                status: { $in: ['open', 'in_progress'] },
                is_archived: false
            });
            allPublicRequests.push(...partyRequests);
        }

        // Set rejected quest IDs for hiding (only if user chooses to)
        const rejectedIds = new Set(applications
          .filter(app => app.status === 'rejected')
          .map(app => app.quest_id)
        );
        setRejectedQuestIds(rejectedIds);
      } else {
        setUserApplications([]);
        setRejectedQuestIds(new Set());
      }
      
      // De-duplicate and filter out user's own posts and posts they're collaborating on
      const questMap = new Map();
      allPublicRequests.forEach(q => {
        const isCollaborator = q.collaborators && q.collaborators.includes(currentUser?.email);
        if (!currentUser || (q.created_by !== currentUser.email && !isCollaborator)) {
          questMap.set(q.id, q);
        }
      });
      
      const finalQuests = Array.from(questMap.values());
      setQuests(finalQuests);
      
    } catch (error) {
        console.error("Error loading Quest Board data:", error);
        setQuests([]);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadQuestBoardData();
  }, [loadQuestBoardData]);
  
  const filteredQuests = quests.filter(quest => {
    if (showAll) return true;
    return !rejectedQuestIds.has(quest.id);
  });

  const handleTeamApplicationSubmitted = () => {
    loadQuestBoardData();
  };

  const handleRefreshRequests = () => {
    setShowAll(true);
  };

  if (isLoading || initialLoading) {
    return (
      <div className="creator-card p-6">
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (filteredQuests.length === 0) {
    if (currentUser) {
      return (
        <div className="creator-card p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="text-yellow-500" />
              Quest Board
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No open requests from your network right now.
            </p>
            <Link to={createPageUrl("Community") + "?tab=matchmaking"}>
              <Button variant="link" className="mt-2">Find more creators to follow</Button>
            </Link>
          </CardContent>
        </div>
      );
    }
    return null;
  }

  const hiddenCount = currentUser && !showAll ? rejectedQuestIds.size : 0;

  return (
    <div className="creator-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Zap className="text-blue-500" />
          Quest Board ({filteredQuests.length})
        </h2>
        {hiddenCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {hiddenCount} hidden
            </span>
            <Button 
              onClick={handleRefreshRequests} 
              variant="ghost" 
              size="sm"
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Show All
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuests.slice(0, 9).map((quest, index) => (
          <QuestBoardCard 
            key={quest.id} 
            quest={quest} 
            index={index} 
            currentUser={currentUser}
            onTeamApplication={handleTeamApplicationSubmitted}
            userApplications={userApplications}
          />
        ))}
      </div>
    </div>
  );
}
