
import React, { useState, useEffect, useCallback } from "react";
import { Quest, User } from "@/api/entities";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Removed motion, AnimatePresence as they are no longer used for list animations in Workspace
import {
  FolderKanban,
  Plus,
  FileText,
  Folder,
  MessageSquare,
  User as UserIcon,
  Edit,
  Target,
  Users,
  Archive,
  PlusCircle,
  UsersRound,
  ExternalLink,
  Settings, // New: for settings button
  LayoutDashboard, // New: for overview tab icon
  Zap, // New: for active projects tab icon
  TrendingUp, // New: for active projects stat icon
  CheckCircle, // New: for completed projects icon
  ArrowRight // New: for view all link
} from "lucide-react";
import { format } from "date-fns";

const questTypeIcons = {
  discussion: MessageSquare,
  file: FileText,
  folder: Folder,
};

// QuestCard Component (Replaces QuestItem and adds new functionality)
const QuestCard = ({ quest, onQuestUpdate, currentUser, showActions, onArchive, onRestore, showForkInfo }) => {
  const Icon = questTypeIcons[quest.quest_type] || MessageSquare;
  const isCreator = currentUser && quest.created_by === currentUser.email;

  return (
    <Card className="creator-card hover:border-blue-300 h-full flex flex-col">
      <CardContent className="p-4 flex-grow">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border flex-shrink-0">
            <Icon className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <Link to={createPageUrl("QuestDetail") + `?id=${quest.id}`}>
              <p className="font-semibold text-gray-900 hover:text-blue-600 truncate">{quest.title}</p>
            </Link>
            <p className="text-sm text-gray-600 line-clamp-1 mt-1">{quest.description}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-2">
              <span>{format(new Date(quest.created_date), "MMM d, yyyy")}</span>
              <Badge variant="outline" className="capitalize">{quest.status}</Badge>
              <Badge variant="secondary" className="capitalize">{quest.quest_type}</Badge>
              {quest.collaborators && quest.collaborators.length > 0 && (
                <Badge variant="secondary" className="capitalize flex items-center gap-1">
                  <UsersRound className="w-3 h-3" />
                  {quest.collaborators.length + 1} team {quest.collaborators.length + 1 === 1 ? 'member' : 'members'}
                </Badge>
              )}
            </div>
            {showForkInfo && quest.original_quest_id && (
              <div className="text-xs text-gray-500 mt-2 flex items-center">
                Forked from:
                <Link to={createPageUrl("QuestDetail") + `?id=${quest.original_quest_id}`} className="ml-1 text-blue-600 hover:underline flex items-center gap-1">
                  Original <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      {showActions && (
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          {isCreator && ( // Only creator can edit or archive/restore their own quests
            <Link to={createPageUrl("CreateQuest") + `?editId=${quest.id}`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" /> Edit
              </Button>
            </Link>
          )}
          {isCreator && (quest.is_archived ? (
            <Button variant="outline" size="sm" onClick={() => onRestore(quest.id)}>
              <Archive className="w-4 h-4 mr-2" /> Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onArchive(quest.id)}>
              <Archive className="w-4 h-4 mr-2" /> Archive
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
};


export default function Workspace() {
  const [currentUser, setCurrentUser] = useState(null);
  const [myQuests, setMyQuests] = useState([]); // Renamed from 'quests'
  const [teamProjects, setTeamProjects] = useState([]); // New state for team projects
  const [archivedQuests, setArchivedQuests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // Changed initial tab to 'overview'

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const me = await User.me();
      setCurrentUser(me);

      if (me) {
        // Fetch user's own quests
        const [myActiveQuests, myArchivedQuests] = await Promise.all([
          Quest.filter({ created_by: me.email, is_archived: false }, "-created_date"),
          Quest.filter({ created_by: me.email, is_archived: true }, "-created_date")
        ]);

        // Fetch team projects where user is a collaborator
        const allQuests = await Quest.list("-created_date", 100); // Fetch a reasonable number, could be paginated
        const userTeamProjects = allQuests.filter(quest =>
          quest.collaborators &&
          quest.collaborators.includes(me.email) &&
          !quest.is_archived &&
          quest.created_by !== me.email // Exclude own projects
        );

        setMyQuests(myActiveQuests);
        setTeamProjects(userTeamProjects);
        setArchivedQuests(myArchivedQuests);
      }
    } catch (error) {
      console.error("Error loading workspace data:", error);
    }
    setIsLoading(false);
  }, []); // Dependencies are stable (state setters, static Quest methods)

  useEffect(() => {
    loadData();
  }, [loadData]); // loadData is a dependency because it's called inside

  // Handler for archiving a quest
  const handleArchive = useCallback(async (questId) => {
    try {
      await Quest.update(questId, { is_archived: true });
      await loadData(); // Reload all data to reflect changes
    } catch (error) {
      console.error("Error archiving quest:", error);
    }
  }, [loadData]);

  // Handler for restoring an archived quest
  const handleRestore = useCallback(async (questId) => {
    try {
      await Quest.update(questId, { is_archived: false });
      await loadData(); // Reload all data to reflect changes
    } catch (error) {
      console.error("Error restoring quest:", error);
    }
  }, [loadData]);

  const stats = {
    totalProjects: myQuests.length,
    activeProjects: myQuests.filter(q => q.status === "in_progress" || q.status === "open").length,
    completedProjects: myQuests.filter(q => q.status === "completed").length,
    teamProjects: teamProjects.length, // New stat
    archivedProjects: archivedQuests.length
  };

  // Helper function to render QuestCard
  const renderQuestCard = useCallback((quest) => {
    return (
      <QuestCard
        key={quest.id}
        quest={quest}
        onQuestUpdate={loadData}
        currentUser={currentUser}
        showActions={true}
        onArchive={handleArchive}
        onRestore={handleRestore}
        showForkInfo={false} // showForkInfo is for specific forked projects, not general team projects
      />
    );
  }, [loadData, currentUser, handleArchive, handleRestore]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="h-48 creator-card animate-pulse mb-8"></div>
        <div className="h-24 creator-card animate-pulse"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center text-gray-700 dark:text-gray-300">
        <p>Please log in to see your workspace.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="creator-card p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                {currentUser?.github_avatar_url ? (
                  <img src={currentUser.github_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {currentUser?.full_name || "Your Workspace"}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
                  {currentUser?.bio || "Manage your projects and team collaborations"}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>{stats.totalProjects} Created</span>
                  <span>•</span>
                  <span>{stats.teamProjects} Team Projects</span>
                  <span>•</span>
                  <span>{stats.completedProjects} Completed</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to={createPageUrl("Settings")}>
                <Button variant="outline" className="creator-btn-secondary">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Link to={createPageUrl("CreateQuest")}>
                <Button className="creator-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="creator-card p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.totalProjects}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Created</p>
          </div>

          <div className="creator-card p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.activeProjects}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Active</p>
          </div>

          <div className="creator-card p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.teamProjects}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Team Projects</p>
          </div>

          <div className="creator-card p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-100 dark:bg-cyan-900/50 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.completedProjects}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Completed</p>
          </div>

          <div className="creator-card p-4 sm:p-6 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
              <Archive className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stats.archivedProjects}</p>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Archived</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="creator-card p-1 mb-6 sm:mb-8">
          <nav className="flex flex-wrap">
            {[
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "active", label: "Active Projects", icon: Zap },
              { id: "team", label: "Team Projects", icon: Users }, // New tab
              { id: "completed", label: "Completed", icon: CheckCircle },
              { id: "archived", label: "Archived", icon: Archive }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6 sm:space-y-8">
              {/* Recent Activity */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Recent Activity</h2>
                {myQuests.length > 0 ? (
                  <div className="grid gap-4 sm:gap-6">
                    {myQuests.slice(0, 3).map(quest => renderQuestCard(quest))}
                  </div>
                ) : (
                  <div className="creator-card p-8 sm:p-12 text-center">
                    <Target className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">No projects yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Start your creative journey by creating your first project</p>
                    <Link to={createPageUrl("CreateQuest")}>
                      <Button className="creator-btn">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Project
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Team Projects Preview */}
              {teamProjects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Team Projects</h2>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("team")}
                      className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      View All <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:gap-6">
                    {teamProjects.slice(0, 2).map(quest => (
                      <div key={quest.id} className="relative">
                        <Badge className="absolute top-2 right-2 z-10 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                          <Users className="w-3 h-3 mr-1" />
                          Team Project
                        </Badge>
                        {renderQuestCard(quest)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "active" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Active Projects</h2>
              {myQuests.filter(q => q.status === "in_progress" || q.status === "open").length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {myQuests.filter(q => q.status === "in_progress" || q.status === "open").map(quest => renderQuestCard(quest))}
                </div>
              ) : (
                <div className="creator-card p-8 sm:p-12 text-center">
                  <Zap className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">No active projects</h3>
                  <p className="text-gray-600 dark:text-gray-400">Your active projects will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "team" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Team Projects</h2>
              {teamProjects.length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {teamProjects.map(quest => (
                    <div key={quest.id} className="relative">
                      <Badge className="absolute top-2 right-2 z-10 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                        <Users className="w-3 h-3 mr-1" />
                        Collaborator
                      </Badge>
                      {renderQuestCard(quest)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="creator-card p-8 sm:p-12 text-center">
                  <Users className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">No team projects yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">Join a team project to start collaborating</p>
                  <Link to={createPageUrl("Dashboard")}>
                    <Button className="creator-btn">
                      <Target className="w-4 h-4 mr-2" />
                      Browse Opportunities
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === "completed" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Completed Projects</h2>
              {myQuests.filter(q => q.status === "completed").length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {myQuests.filter(q => q.status === "completed").map(quest => renderQuestCard(quest))}
                </div>
              ) : (
                <div className="creator-card p-8 sm:p-12 text-center">
                  <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">No completed projects</h3>
                  <p className="text-gray-600 dark:text-gray-400">Your completed projects will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "archived" && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">Archived Projects</h2>
              {archivedQuests.length > 0 ? (
                <div className="grid gap-4 sm:gap-6">
                  {archivedQuests.map(quest => renderQuestCard(quest))}
                </div>
              ) : (
                <div className="creator-card p-8 sm:p-12 text-center">
                  <Archive className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">No archived projects</h3>
                  <p className="text-gray-600 dark:text-gray-400">Archived projects will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
