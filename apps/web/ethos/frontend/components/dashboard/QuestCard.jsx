
import React, { useState, useEffect } from "react";
import { User, Quest, TeamApplication, QuestLike } from "@/api/entities";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Folder,
  MessageSquare,
  Heart,
  MessageCircle,
  Copy,
  UserPlus,
  Star,
  Eye,
  Github,
  CheckCircle2,
  MoreHorizontal,
  Archive,
  Trash2,
  Link as LinkIcon,
  Plus,
  Pencil,
  Users,
  Globe,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import TeamApplicationModal from "./TeamApplicationModal";
import ConvertToProjectModal from "./ConvertToProjectModal";
import StatusToggle from '../shared/StatusToggle';
import { getUserDisplayName } from "../shared/UserDisplay";

const questTypeIcons = {
  discussion: MessageSquare,
  project_quest: FileText,
  party_folder: Folder
};

const visibilityIcons = {
  public: Globe,
  followers: Users,
  private: Lock,
};

const questTypeColors = {
  discussion: "bg-blue-100 text-blue-700 border-blue-200",
  project_quest: "bg-green-100 text-green-700 border-green-200",
  party_folder: "bg-purple-100 text-purple-700 border-purple-200"
};

const roleTypeColors = {
  creator: "bg-purple-100 text-purple-700",
  developer: "bg-blue-100 text-blue-700",
  freelancer: "bg-green-100 text-green-700",
  explorer: "bg-orange-100 text-orange-700"
};

export default function QuestCard({ quest, index, onQuestUpdate, currentUser, userLike, onLikeUpdate }) {
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(quest.like_count || 0);
  const [currentUserLike, setCurrentUserLike] = useState(null);

  const isCreator = currentUser && currentUser.email === quest.created_by;
  const isCollaborator = currentUser && quest.collaborators?.includes(currentUser.email);

  // Check permissions - Fixed logic
  const canEditFiles = isCreator || (isCollaborator && quest.team_permissions?.can_edit_files === true);
  const canAddComments = isCreator || (isCollaborator && quest.team_permissions?.can_add_comments !== false) || (quest.team_permissions?.public_can_comment !== false);

  useEffect(() => {
    if (userLike) {
        setIsLiked(true);
        setCurrentUserLike(userLike);
    } else {
        setIsLiked(false);
        setCurrentUserLike(null);
    }
    setLikeCount(quest.like_count || 0);
  }, [userLike, quest.like_count]);

  const handleLike = async () => {
    if (!currentUser) {
      alert("You must be logged in to like a post.");
      return;
    }

    // Store original values for potential rollback
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    
    // Calculate new values
    const newIsLiked = !originalIsLiked;
    const newLikeCount = newIsLiked 
      ? originalLikeCount + 1 
      : Math.max(0, originalLikeCount - 1);

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);

    try {
      let newLike = null;
      if (newIsLiked) {
        newLike = await QuestLike.create({ 
          quest_id: quest.id, 
          user_email: currentUser.email 
        });
        setCurrentUserLike(newLike);
      } else {
        if (currentUserLike) {
          await QuestLike.delete(currentUserLike.id);
          setCurrentUserLike(null);
        } else {
          const existingLikes = await QuestLike.filter({ 
            quest_id: quest.id, 
            user_email: currentUser.email 
          });
          if (existingLikes.length > 0) {
            await QuestLike.delete(existingLikes[0].id);
          }
        }
      }
      
      onLikeUpdate(quest.id, newLike);

      if (onQuestUpdate) onQuestUpdate();

    } catch (error) {
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
      console.error("Failed to update like:", error);
      alert("Failed to update like. Please try again.");
    }
  };

  const handleRequestToggle = async () => {
    let updateData = {};
    const isRequesting = quest.request_type !== 'none';

    if (isRequesting) {
      updateData.request_type = 'none';
      updateData.request_visibility = 'public';
      if (quest.status === 'in_progress') { 
        updateData.status = 'open';
      }
    } else {
      updateData.status = 'in_progress';
      
      switch (quest.quest_type) {
        case 'discussion':
          updateData.request_type = 'feedback';
          break;
        case 'project_quest':
        case 'party_folder':
        case 'guild_repo':
          updateData.request_type = 'team_help';
          break;
        default:
          updateData.request_type = 'feedback';
      }

      switch(quest.visibility) {
        case 'public':
          updateData.request_visibility = 'public';
          break;
        case 'followers':
          updateData.request_visibility = 'followers_only';
          break;
        case 'private':
          if (quest.party_id) {
            updateData.request_visibility = 'party_only';
          } else {
            updateData.request_visibility = 'followers_only';
          }
          break;
        default:
          updateData.request_visibility = 'public';
      }
    }

    try {
      await Quest.update(quest.id, updateData);
      if (onQuestUpdate) onQuestUpdate();
    } catch(error) {
      console.error("Failed to toggle request:", error);
      alert("There was an error updating the request.");
    }
  };

  const handleTeamApplication = async (applicationData) => {
    await TeamApplication.create({
      quest_id: quest.id,
      applicant_email: currentUser.email,
      ...applicationData
    });
    setShowTeamModal(false);
  };

  const handleConvertToProject = async (projectData) => {
    await Quest.update(quest.id, {
      quest_type: "project",
      github_url: projectData.github_url
    });
    if (onQuestUpdate) onQuestUpdate();
    setShowConvertModal(false);
  };

  const handleStatusChange = async (newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
        updateData.request_type = 'none';
    }
    await Quest.update(quest.id, updateData);
    if (onQuestUpdate) onQuestUpdate();
  };

  const handleArchive = async () => {
    if (!window.confirm("Are you sure you want to archive this quest? It will be hidden from public feeds.")) return;
    
    try {
      await Quest.update(quest.id, { is_archived: true });
      alert("Quest archived successfully!");
      if (onQuestUpdate) {
        onQuestUpdate();
      }
    } catch (error) {
      console.error("Failed to archive quest:", error);
      alert("Failed to archive quest. You may not have permission to perform this action.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this quest? This action cannot be undone.")) return;
    
    try {
      await Quest.delete(quest.id);
      alert("Quest deleted successfully!");
      if (onQuestUpdate) {
        onQuestUpdate();
      }
    } catch (error) {
      console.error("Failed to delete quest:", error);
      alert("Failed to delete quest. You may not have permission to perform this action.");
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${createPageUrl("QuestDetail")}?id=${quest.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Link copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  };

  const QuestIcon = questTypeIcons[quest.quest_type] || MessageSquare;
  const hasOpenRequest = quest.request_type !== 'none';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="w-full max-w-full"
      >
        <Card className="creator-card w-full overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="whitespace-nowrap">{format(new Date(quest.created_date), "MMM d")}</span>
                  <span className="whitespace-nowrap">by {getUserDisplayName(quest.creator_user || quest.created_by)}</span>
                  {quest.average_rating > 0 && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span>{quest.average_rating.toFixed(1)}</span>
                        <span className="text-gray-400 dark:text-gray-500">({quest.rating_count})</span>
                      </div>
                    </>
                  )}
                  {quest.collaborators && quest.collaborators.length > 0 && (
                    <>
                      <span className="hidden sm:inline">·</span>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Users className="w-3 h-3" />
                        <span>{quest.collaborators.length + 1} team {quest.collaborators.length + 1 === 1 ? 'member' : 'members'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                 <Badge variant="outline" className="gap-1 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                  {React.createElement(visibilityIcons[quest.visibility] || Globe, { className: "w-3 h-3" })}
                  <span className="hidden sm:inline">{quest.visibility}</span>
                </Badge>

                {quest.quest_type === 'project_quest' && quest.collaborators && quest.collaborators.length > 0 && (
                  <div className="flex items-center gap-1">
                    {quest.team_permissions?.can_edit_files && (
                      <Badge variant="outline" className="border-green-200 dark:border-green-700 text-green-600 dark:text-green-300 text-xs gap-1">
                        <FileText className="w-3 h-3" />
                        <span className="hidden sm:inline">Edit Files</span>
                      </Badge>
                    )}
                    {quest.team_permissions?.public_can_comment && (
                      <Badge variant="outline" className="border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300 text-xs gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span className="hidden sm:inline">Public Comments</span>
                      </Badge>
                    )}
                  </div>
                )}

                {quest.parent_quest_id && (
                  <Link to={createPageUrl("QuestDetail") + "?id=" + quest.parent_quest_id}>
                    <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 gap-1 border text-xs hover:bg-gray-200 dark:hover:bg-gray-600">
                      <Folder className="w-3 h-3" />
                      <span className="hidden sm:inline">In Folder</span>
                    </Badge>
                  </Link>
                )}

                <Badge className={`${questTypeColors[quest.quest_type]} border text-xs capitalize`}>
                  <span className="hidden xs:inline">{quest.quest_type}</span>
                  <QuestIcon className="w-3 h-3 xs:hidden" />
                </Badge>

                {quest.github_url && (
                  <a href={quest.github_url} target="_blank" rel="noopener noreferrer">
                    <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-1">
                      <Github className="w-3 h-3" />
                    </Badge>
                  </a>
                )}

                {hasOpenRequest && quest.status !== 'completed' ? (
                  <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 border text-xs">
                    {quest.request_type === 'team_help' ? (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span className="hidden sm:inline">Team</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">Feedback</span>
                      </>
                    )}
                  </Badge>
                ) : null}

                {isCreator ? (
                  <StatusToggle status={quest.status} isCreator={isCreator} onStatusChange={handleStatusChange} />
                ) : (
                  quest.status === 'completed' && (
                    <Badge className="bg-green-50 text-green-700 border-green-200 gap-1 border text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Done</span>
                    </Badge>
                  )
                )}

                {/* Show edit button for creator OR collaborators with edit permissions */}
                {(isCreator || canEditFiles) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white flex-shrink-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="dark:bg-gray-800 dark:border-gray-700">
                      <Link to={createPageUrl("CreateQuest") + "?editId=" + quest.id}>
                        <DropdownMenuItem className="dark:text-gray-300 dark:hover:bg-gray-700">
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>{isCreator ? "Edit Post" : "Edit Files"}</span>
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={handleCopyLink} className="dark:text-gray-300 dark:hover:bg-gray-700">
                        <LinkIcon className="mr-2 h-4 w-4" />
                        <span>Copy Link</span>
                      </DropdownMenuItem>
                      {/* Only creators can archive and delete */}
                      {isCreator && (
                        <>
                          <DropdownMenuSeparator className="dark:bg-gray-700" />
                          <DropdownMenuItem onClick={handleArchive} className="dark:text-gray-300 dark:hover:bg-gray-700">
                            <Archive className="mr-2 h-4 w-4" />
                            <span>Archive</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/50">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-4 md:p-6 pt-0">
            <Link
              to={createPageUrl("QuestDetail") + "?id=" + quest.id}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors block"
            >
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white mt-2 mb-1 line-clamp-2 break-words">
                {quest.title}
              </h3>
            </Link>
            <p className="text-gray-700 dark:text-gray-300 line-clamp-3 text-xs sm:text-sm md:text-base break-words">
              {quest.description}
            </p>

            {quest.request_type === 'team_help' && quest.team_roles && quest.team_roles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Looking for:</p>
                <div className="flex flex-wrap gap-1">
                  {quest.team_roles.map((role, idx) => (
                    <Badge key={idx} className={`${roleTypeColors[role.role_type]} border text-xs`}>
                      <span className="truncate">
                        {role.count} {role.role_type}{role.count > 1 ? 's' : ''}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {quest.tags && quest.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {quest.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 truncate max-w-[80px]">
                    {tag}
                  </Badge>
                ))}
                {quest.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800">
                    +{quest.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            <div className="pt-2 sm:pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 text-gray-500 dark:text-gray-400">
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1 hover:text-red-500 transition-colors ${
                      isLiked ? "text-red-500" : ""
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    <span className="text-xs sm:text-sm">{likeCount}</span>
                  </button>
                  <Link to={createPageUrl("QuestDetail") + `?id=${quest.id}#discussion`} className="flex items-center gap-1 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{quest.comment_count || 0}</span>
                  </Link>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {quest.quest_type === 'discussion' && !quest.parent_quest_id && isCreator && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="text-xs py-1.5 px-2 sm:px-3 border-purple-200 dark:border-purple-700 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/50"
                    >
                      <Link to={createPageUrl("CreateQuest") + "?linkDiscussion=" + quest.id}>
                        <FileText className="w-3 h-3 mr-1" />
                        <span className="hidden xs:inline">Make File</span>
                      </Link>
                    </Button>
                  )}
                  {quest.status !== 'completed' && !isCreator && hasOpenRequest && (
                    quest.request_type === 'team_help' ? (
                      <button
                        onClick={() => setShowTeamModal(true)}
                        className="creator-btn text-xs py-1.5 px-2 sm:px-3"
                      >
                        <span className="hidden xs:inline">Join</span>
                        <UserPlus className="w-3 h-3 xs:hidden" />
                      </button>
                    ) : (
                      <Button asChild className="creator-btn text-xs py-1.5 px-2 sm:px-3">
                        <Link to={createPageUrl("QuestDetail") + `?id=${quest.id}&action=feedback`}>
                          <span className="hidden xs:inline">Feedback</span>
                          <Eye className="w-3 h-3 xs:hidden" />
                        </Link>
                      </Button>
                    )
                  )}
                   {isCreator && (quest.status === 'open' || quest.status === 'in_progress' || quest.status === 'completed') && (
                     <button
                      onClick={handleRequestToggle}
                      className={`creator-btn-secondary text-xs py-1.5 px-2 sm:px-3 ${hasOpenRequest ? 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700' : ''}`}
                    >
                      <Star className={`w-3 h-3 ${hasOpenRequest ? 'text-yellow-500 fill-current' : ''}`} />
                      <span className="hidden xs:inline">{hasOpenRequest ? "Requesting" : "Request"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {showTeamModal && (
        <TeamApplicationModal
          quest={quest}
          availableRoles={quest.team_roles || []}
          onClose={() => setShowTeamModal(false)}
          onSubmit={handleTeamApplication}
        />
      )}

      {showConvertModal && (
        <ConvertToProjectModal
          quest={quest}
          onClose={() => setShowConvertModal(false)}
          onSubmit={handleConvertToProject}
        />
      )}
    </>
  );
}
