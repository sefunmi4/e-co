
import React, { useState, useEffect, useCallback } from "react";
import { TeamApplication, User, Quest, Party } from "@/api/entities"; // Added Party
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Check, X, ExternalLink, Eye } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const roleTypeColors = {
  creator: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  developer: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", 
  freelancer: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  explorer: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
};

export default function TeamApplications({ userQuests, currentUser, onUpdate }) {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadApplications = useCallback(async () => {
    if (!currentUser || !userQuests.length) {
      setIsLoading(false);
      return;
    }

    try {
      const questIds = userQuests.map(q => q.id);
      const allApplications = await Promise.all(
        questIds.map(questId => 
          TeamApplication.filter({ quest_id: questId, status: "pending" }, "-created_date")
        )
      );
      
      const flatApplications = allApplications.flat();
      setApplications(flatApplications);
    } catch (error) {
      console.error("Error loading applications:", error);
    }
    setIsLoading(false);
  }, [userQuests, currentUser]); // Dependencies for useCallback

  useEffect(() => {
    loadApplications();
  }, [loadApplications]); // useEffect now depends on the memoized loadApplications

  const handleApplication = async (application, action) => {
    try {
      await TeamApplication.update(application.id, { status: action });
      
      // If accepted, add to collaborators and create a party
      if (action === 'accepted') {
        const quest = userQuests.find(q => q.id === application.quest_id);
        if (quest) {
          const currentCollaborators = quest.collaborators || [];
          if (!currentCollaborators.includes(application.applicant_email)) {
            // Update original quest with new collaborator
            const updatedCollaborators = [...currentCollaborators, application.applicant_email];
            await Quest.update(quest.id, {
              collaborators: updatedCollaborators
            });
            
            // Check if a party already exists for this project
            const parties = await Party.filter({ project_quest_id: quest.id });
            let party;

            if (parties.length > 0) {
              // Party exists, add new member
              party = parties[0];
              const updatedMembers = [...new Set([...party.member_emails, application.applicant_email])];
              await Party.update(party.id, { member_emails: updatedMembers });
            } else {
              // Party doesn't exist, create it
              const allTeamMembers = [quest.created_by, ...updatedCollaborators];
              const allUsers = await User.list();
              const teamUsers = allUsers.filter(user => allTeamMembers.includes(user.email));
              const creatorUser = teamUsers.find(user => user.email === quest.created_by);
              const otherUsers = teamUsers.filter(user => user.email !== quest.created_by);
              const creatorName = creatorUser?.full_name?.split(' ')[0] || creatorUser?.email.split('@')[0] || 'Creator';
              const otherNames = otherUsers.map(user => user.full_name?.split(' ')[0] || user.email.split('@')[0]);
              const teamNamesString = [creatorName, ...otherNames].join(', ');
              
              const partyData = {
                name: `${quest.title} - Team`,
                description: `Collaborative workspace for "${quest.title}"\n\nTeam Members: ${teamNamesString}`,
                party_type: 'team',
                member_emails: allTeamMembers,
                admin_emails: [quest.created_by], // Creator is admin
                project_quest_id: quest.id,
                last_activity: new Date().toISOString()
              };
              party = await Party.create(partyData);
              
              // Update the original quest to link to the party
              await Quest.update(quest.id, {
                party_id: party.id,
                visibility: 'private' // Make the quest private since it's now in a party
              });
            }
            // No longer creating a forked copy for the new team member
          }
        }
      }
      
      if (onUpdate) {
        onUpdate();
      } else {
        loadApplications();
      }
    } catch (error) {
      console.error("Error handling application:", error);
      alert("Failed to process application. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="creator-card p-6">
        <div className="h-6 w-1/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
        <div className="space-y-3">
          {Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return null; // Don't show the component if no applications
  }

  return (
    <div className="creator-card p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Users className="text-green-500" />
        Team Applications ({applications.length})
      </h2>
      
      <div className="space-y-4">
        <AnimatePresence>
          {applications.map((application) => {
            const quest = userQuests.find(q => q.id === application.quest_id);
            // +1 for the original quest creator
            const currentTeamSize = (quest?.collaborators?.length || 0) + 1;
            
            return (
              <motion.div
                key={application.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {application.applicant_email.split('@')[0]}
                      </span>
                      <Badge className={`${roleTypeColors[application.role_type]} border text-xs`}>
                        {application.role_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      wants to join: <span className="font-medium">{quest?.title}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                      <span>{format(new Date(application.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                      <span>•</span>
                      <span>Current team: {currentTeamSize} {currentTeamSize === 1 ? 'member' : 'members'}</span>
                      <span>•</span>
                      <span>Will become: {currentTeamSize + 1} {currentTeamSize + 1 === 1 ? 'member' : 'members'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-md p-3 mb-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {application.application_message}
                  </p>
                </div>

                {application.portfolio_links && application.portfolio_links.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Portfolio:</p>
                    <div className="flex flex-wrap gap-2">
                      {application.portfolio_links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Portfolio {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApplication(application, 'accepted')}
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplication(application, 'rejected')}
                    className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
