
import React, { useState, useEffect, useCallback } from "react";
import { Quest, Guild, User, QuestLike, QuestComment, UserFollow, GuildMembership } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  TrendingUp,
  Users,
  Target,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

import QuestCard from "../components/dashboard/QuestCard";
import StatsOverview from "../components/dashboard/StatsOverview";
import ActiveGuilds from "../components/dashboard/ActiveGuilds";
import QuestFilters from "../components/dashboard/QuestFilters";
import QuestBoard from "../components/dashboard/QuestBoard";
import TeamApplications from "../components/dashboard/TeamApplications";
import MyRequests from "../components/dashboard/MyRequests";

export default function Dashboard() {
  const [quests, setQuests] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userQuests, setUserQuests] = useState([]);
  const [userLikesMap, setUserLikesMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    quest_type: "all",
    difficulty: "all"
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch user and basic data first
      const [me, initialGuildData] = await Promise.all([
        User.me().catch(() => null),
        Guild.list("-created_date", 10)
      ]);

      // Calculate accurate counts for guilds
      const guildData = await Promise.all(
        initialGuildData.map(async (guild) => {
          const [members, questsInGuild] = await Promise.all([
            GuildMembership.filter({ guild_id: guild.id }),
            Quest.filter({ guild_id: guild.id, is_archived: false })
          ]);
          return {
            ...guild,
            member_count: members.length,
            quest_count: questsInGuild.length,
          };
        })
      );

      // 1. Fetch all public quests - now available to all users
      const publicQuests = await Quest.filter({ visibility: 'public', is_archived: false }, "-created_date", 100);
      let allVisibleQuests = [...publicQuests];

      // 2. If user is logged in, fetch additional content they can see
      if (me) {
        // Fetch 'followers-only' quests from followed users
        const followingList = await UserFollow.filter({ follower_email: me.email });
        const followedEmails = followingList.map(f => f.following_email);

        if (followedEmails.length > 0) {
          const followerQuestsPromises = followedEmails.map(email =>
            Quest.filter({
              created_by: email,
              visibility: 'followers',
              is_archived: false
            })
          );
          const followerQuestsArrays = await Promise.all(followerQuestsPromises);
          const followerQuests = followerQuestsArrays.flat();
          allVisibleQuests.push(...followerQuests);
        }

        // Fetch user's own posts (all visibilities, including private)
        const myQuests = await Quest.filter({ created_by: me.email, is_archived: false });
        allVisibleQuests.push(...myQuests); // Add user's own posts after public and followers posts
      }
      
      // 3. De-duplicate quests (in case a public post is from a followed user or user's own post)
      const questMap = new Map();
      allVisibleQuests.forEach(q => questMap.set(q.id, q));
      const uniqueQuests = Array.from(questMap.values());
      
      // 4. Sort the combined list by date to ensure the feed is chronological
      uniqueQuests.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      
      // 5. Get creator data for display purposes (but don't filter based on it)
      const creatorEmails = [...new Set(uniqueQuests.map(quest => quest.created_by))];
      
      let creators = [];
      try {
        const allUsers = await User.list();
        creators = allUsers.filter(user => 
          creatorEmails.includes(user.email) && 
          (!user.account_status || user.account_status === 'active')
        );
        if (me && !creators.find(creator => creator.email === me.email)) {
          creators.push(me);
        }
      } catch (error) {
        console.warn("Cannot fetch creator data:", error);
        if (me) {
          creators = [me];
        }
      }

      const creatorMap = new Map(creators.map(creator => [creator.email, creator]));

      // 6. Add creator info and counts without filtering out posts
      const questsWithCounts = await Promise.all(
        uniqueQuests.map(async (quest) => {
          const [likes, comments] = await Promise.all([
            QuestLike.filter({ quest_id: quest.id }),
            QuestComment.filter({ quest_id: quest.id })
          ]);

          const ratedComments = comments.filter(c => c.rating);
          const averageRating = ratedComments.length > 0
            ? ratedComments.reduce((sum, c) => sum + c.rating, 0) / ratedComments.length
            : 0;

          return {
            ...quest,
            creator_user: creatorMap.get(quest.created_by) || null,
            like_count: likes.length,
            comment_count: comments.length,
            rating_count: ratedComments.length,
            average_rating: averageRating
          };
        })
      );

      setQuests(questsWithCounts);
      setGuilds(guildData);
      setCurrentUser(me);

      if (me) {
        // Fetch quests created by the user specifically for the Team Applications component
        const createdQuests = await Quest.filter({ created_by: me.email }, "-created_date");
        setUserQuests(createdQuests); 

        const userLikesData = await QuestLike.filter({ user_email: me.email });
        const likesMap = new Map(userLikesData.map(like => [like.quest_id, like]));
        setUserLikesMap(likesMap);
      } else {
        setUserLikesMap(new Map());
        setUserQuests([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLikeUpdate = (questId, newLikeRecord) => {
    const newMap = new Map(userLikesMap);
    if (newLikeRecord) {
        newMap.set(questId, newLikeRecord);
    } else {
        newMap.delete(questId);
    }
    setUserLikesMap(newMap);
    
    // Reload data to get fresh counts
    loadData();
  };

  const filteredQuests = quests.filter(quest => {
    // The `quest.is_archived` check here is redundant if `quests` already only contains active quests,
    // but it does no harm and acts as a safeguard.
    if (quest.is_archived) return false; 
    
    const matchesSearch = quest.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quest.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status === "all" || quest.status === filters.status;
    const matchesPriority = filters.priority === "all" || quest.priority === filters.priority;
    const matchesType = filters.quest_type === "all" || quest.quest_type === filters.quest_type;
    const matchesDifficulty = filters.difficulty === "all" || quest.difficulty === filters.difficulty;

    return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesDifficulty;
  });

  // Filter quests specifically for the Quest Board (all public opportunities)
  const questBoardQuests = quests.filter(quest => 
    quest.visibility === 'public'
  );

  const questStats = {
    total: quests.length,
    active: quests.filter(q => q.status === "open" || q.status === "in_progress").length,
    completed: quests.filter(q => q.status === "completed").length,
    avgCompletion: Math.round(
      quests.reduce((sum, q) => sum + (q.completion_percentage || 0), 0) / (quests.length || 1)
    )
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center py-4 sm:py-6 md:py-8">
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 md:mb-4">
            Welcome to Your Creative Hub
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-4 md:mb-6 max-w-2xl mx-auto px-2 sm:px-4">
            Share your work, get feedback, find collaborators, and grow your creative practice with a supportive community.
          </p>
          <Link to={createPageUrl("CreateQuest")}>
            <button className="creator-btn text-sm sm:text-base md:text-lg px-4 sm:px-6 py-2 sm:py-3">
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              Share Something New
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 items-start">
          {/* Main Feed */}
          <div className="lg:col-span-3 space-y-3 sm:space-y-4 md:space-y-6 w-full">

            {/* Team Applications - Show only if user has pending applications */}
            {currentUser && (
              <TeamApplications 
                userQuests={userQuests} 
                currentUser={currentUser} 
                onUpdate={loadData}
              />
            )}

            {/* My Requests - New Component */}
            {currentUser && <MyRequests currentUser={currentUser} isLoading={isLoading} />}
            
            {/* Open Opportunities -> Quest Board */}
            <QuestBoard quests={questBoardQuests} isLoading={isLoading} currentUser={currentUser} />

            {/* Search and Filters */}
            <div className="creator-card p-3 sm:p-4 md:p-6 w-full">
              <div className="flex flex-col gap-3 md:gap-4">
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                    <Input
                      placeholder="Search posts, projects, and ideas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 sm:h-11 md:h-12 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 rounded-lg text-sm sm:text-base w-full"
                    />
                  </div>
                </div>
                <div className="flex justify-start">
                  <QuestFilters filters={filters} onFilterChange={setFilters} />
                </div>
              </div>
            </div>

            {/* Feed Posts */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <div className="space-y-3 w-full">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="creator-card h-32 sm:h-40 md:h-48 animate-pulse w-full"></div>
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3 sm:space-y-4 w-full"
                >
                  {filteredQuests.length > 0 ? (
                    filteredQuests.map((quest, index) => (
                      <div key={quest.id} className="w-full">
                        <QuestCard
                          quest={quest}
                          index={index}
                          onQuestUpdate={loadData}
                          currentUser={currentUser}
                          userLike={userLikesMap.get(quest.id)}
                          onLikeUpdate={handleLikeUpdate}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="creator-card p-6 sm:p-8 md:p-12 text-center w-full">
                      <Target className="w-8 h-8 md:w-12 md:h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3 md:mb-4" />
                      <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">No posts found</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 md:mb-6 text-sm md:text-base">Try adjusting your search or be the first to share something!</p>
                      <Link to={createPageUrl("CreateQuest")}>
                        <button className="creator-btn text-sm sm:text-base">
                          <Plus className="w-4 h-4" />
                          Create First Post
                        </button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar - Hidden on mobile, shown on large screens */}
          <div className="hidden lg:block lg:col-span-1 space-y-4 md:space-y-6">
            <StatsOverview stats={questStats} isLoading={isLoading} />
            <ActiveGuilds guilds={guilds} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
