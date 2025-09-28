
import React, { useState, useEffect } from "react";
import { QuestLog, Quest, User, Notification, GuildMembership } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BookOpen, 
  Search,
  Filter,
  Clock,
  User as UserIcon, // Alias User to UserIcon to avoid conflict with entity User
  Activity,
  CheckCircle,
  MessageSquare,
  Settings,
  Plus,
  Mail,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { getUserDisplayName } from "../components/shared/UserDisplay";

const actionIcons = {
  created: Plus,
  updated: Settings,
  commented: MessageSquare,
  status_changed: Activity,
  collaborated: UserIcon,
  completed: CheckCircle,
  guild_invite: Mail,
};

const actionColors = {
  created: "text-blue-600 bg-blue-100",
  updated: "text-yellow-600 bg-yellow-100",
  commented: "text-purple-600 bg-purple-100",
  status_changed: "text-orange-600 bg-orange-100",
  collaborated: "text-green-600 bg-green-100",
  completed: "text-cyan-600 bg-cyan-100"
};

export default function QuestLogs() {
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [quests, setQuests] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const me = await User.me().catch(() => null);
      setCurrentUser(me);

      const [logsData, questsData, notificationsData] = await Promise.all([
        QuestLog.list("-created_date", 100),
        Quest.list("-created_date", 50),
        me ? Notification.filter({ recipient_email: me.email, status: "pending" }, "-created_date") : Promise.resolve([])
      ]);
      setLogs(logsData);
      setQuests(questsData);
      setNotifications(notificationsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleNotification = async (notification, response) => {
      if (!currentUser) return; // Should not happen if notifications are loaded only for logged in user

      if (response === 'accepted') {
          if (notification.type === 'guild_invite') {
              try {
                  await GuildMembership.create({
                      guild_id: notification.related_guild_id,
                      user_email: currentUser.email
                  });
              } catch (error) {
                  console.error("Error accepting guild invite:", error);
                  // Optionally show an error message to the user
                  return; 
              }
          }
      }
      try {
          await Notification.update(notification.id, { status: response });
      } catch (error) {
          console.error("Error updating notification status:", error);
          // Optionally show an error message to the user
      }
      loadData(); // Refresh data
  };

  const getQuestTitle = (questId) => {
    const quest = quests.find(q => q.id === questId);
    return quest ? quest.title : "Unknown Quest";
  };
  
  const allActivities = [
      ...logs.map(log => ({ ...log, activityType: 'log' })),
      ...notifications.map(n => ({...n, activityType: 'notification' }))
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const filteredActivities = allActivities.filter(activity => {
    const matchesSearch = activity.activityType === 'log'
      ? (activity.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
         getQuestTitle(activity.quest_id).toLowerCase().includes(searchTerm.toLowerCase()))
      : activity.message.toLowerCase().includes(searchTerm.toLowerCase()); // Notifications only have message

    // FilterType only applies to 'log' activities. Notifications are always included if not filtered out by search.
    const matchesType = filterType === "all" || (activity.activityType === 'log' && activity.action_type === filterType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen p-6 bg-slate-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="feed-card p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-gray-100 mb-2">
                Quest Logs
              </h1>
              <p className="text-xl text-slate-600 dark:text-gray-300 mb-4">
                Track the journey and progress of all collaborative quests
              </p>
              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>{logs.length} Total Activities</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="feed-card p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input
                  placeholder="Search logs and quests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 bg-slate-100/50 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48 bg-slate-100/50 border-slate-200 text-slate-800">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="commented">Commented</SelectItem>
                  <SelectItem value="status_changed">Status Changed</SelectItem>
                  <SelectItem value="collaborated">Collaborated</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Logs Timeline */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-gray-100 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-green-500" />
            Activity Timeline ({filteredActivities.length})
          </h2>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="space-y-4">
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} className="feed-card h-20 animate-pulse"></div>
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {filteredActivities.map((activity, index) => {
                  if (activity.activityType === 'log') {
                    const ActionIcon = actionIcons[activity.action_type] || Activity;
                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="feed-card glow-effect transition-all duration-300">
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${actionColors[activity.action_type]}`}>
                                <ActionIcon className="w-5 h-5" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h3 className="text-slate-800 dark:text-gray-100 font-medium mb-1">
                                      {getQuestTitle(activity.quest_id)}
                                    </h3>
                                    <p className="text-slate-600 dark:text-gray-300 mb-2">
                                      {activity.message}
                                    </p>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-gray-400">
                                      <div className="flex items-center gap-1">
                                        <UserIcon className="w-3 h-3" />
                                        <span>{activity.user_email.split('@')[0]}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{format(new Date(activity.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Action Badge */}
                                  <Badge 
                                    variant="outline" 
                                    className={`${actionColors[activity.action_type]} border-current capitalize`}
                                  >
                                    {activity.action_type.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  } else { // Notification
                     const ActionIcon = actionIcons[activity.type] || Mail;
                     return (
                         <motion.div 
                            key={activity.id} 
                            initial={{ opacity: 0, x: -20 }} 
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                         >
                             <Card className="feed-card bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
                                 <CardContent className="p-6">
                                     <div className="flex items-start gap-4">
                                         <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400">
                                            <ActionIcon className="w-5 h-5" />
                                         </div>
                                         <div className="flex-1">
                                             <p className="text-slate-800 dark:text-gray-100">{activity.message}</p>
                                             <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{format(new Date(activity.created_date), "MMM d, yyyy")}</p>
                                         </div>
                                         <div className="flex gap-2">
                                             <Button size="icon" variant="outline" className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:hover:bg-green-900" onClick={() => handleNotification(activity, 'accepted')}>
                                                <Check className="w-4 h-4"/>
                                             </Button>
                                             <Button size="icon" variant="outline" className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900" onClick={() => handleNotification(activity, 'declined')}>
                                                 <X className="w-4 h-4"/>
                                             </Button>
                                         </div>
                                     </div>
                                 </CardContent>
                             </Card>
                         </motion.div>
                     )
                  }
                })}

                {filteredActivities.length === 0 && (
                  <div className="feed-card p-12 text-center">
                    <BookOpen className="w-12 h-12 text-slate-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-gray-100 mb-2">No activity logs found</h3>
                    <p className="text-slate-500 dark:text-gray-400 mb-6">
                      {searchTerm || filterType !== "all" 
                        ? "Try adjusting your search or filters" 
                        : "Quest activity will appear here as users interact with quests"
                      }
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
