
import React, { useState, useEffect } from "react";
import { Guild, User, GuildMembership, Quest } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  Filter,
  UserPlus,
  Settings,
  Eye,
  Lock,
  Crown,
  MessageSquare,
  FileText,
  Folder,
  Globe, // Added Globe icon
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { getUserDisplayName } from "../shared/UserDisplay";

const guildTypeColors = {
  creator: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-200",
  developer: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
  freelancer: "border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200",
  explorer: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-200",
  custom: "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
};

const questTypeIcons = {
  discussion: MessageSquare,
  project_quest: FileText,
  party_folder: Folder,
};

export default function GuildsView() {
  const [guilds, setGuilds] = useState([]);
  const [userMemberships, setUserMemberships] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [guildTypeFilter, setGuildTypeFilter] = useState("all");
  const [joinedGuildsFilter, setJoinedGuildsFilter] = useState("all");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [user, guildData] = await Promise.all([
        User.me().catch(() => null),
        Guild.list("-created_date")
      ]);

      setCurrentUser(user);

      // Calculate accurate counts for each guild, filtering out archived guilds
      const guildsWithCounts = await Promise.all(
        guildData.map(async (guild) => {
          if (guild.is_archived) return null; // Filter out archived guilds

          const [members, quests] = await Promise.all([
            GuildMembership.filter({ guild_id: guild.id }),
            Quest.filter({ guild_id: guild.id, is_archived: false })
          ]);

          return {
            ...guild,
            member_count: members.length,
            quest_count: quests.length,
          };
        })
      );

      // Remove null entries from archived guilds
      setGuilds(guildsWithCounts.filter(Boolean));

      // Get user's guild memberships
      if (user) {
        const memberships = await GuildMembership.filter({ user_email: user.email });
        const membershipSet = new Set(memberships.map(m => m.guild_id));
        setUserMemberships(membershipSet);
      } else {
        setUserMemberships(new Set());
      }
    } catch (error) {
      console.error("Error loading guilds:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleJoinGuild = async (guild) => {
    if (!currentUser) {
      alert("Please log in to join guilds.");
      return;
    }

    let passcode = '';
    if (!guild.is_public) {
        passcode = prompt("This guild is private. Please enter the passcode to join:");
        if (passcode === null) return; // User cancelled prompt
        if (passcode !== guild.passcode) {
            alert("Incorrect passcode. Please try again.");
            return;
        }
    }
    
    try {
      const existingMembership = await GuildMembership.filter({ 
        guild_id: guild.id, 
        user_email: currentUser.email 
      });
      
      if (existingMembership.length > 0) {
        alert("You are already a member of this guild!");
        return;
      }

      await GuildMembership.create({
        guild_id: guild.id,
        user_email: currentUser.email,
        joined_date: new Date().toISOString()
      });
      
      try {
        await Guild.update(guild.id, {
          member_count: (guild.member_count || 0) + 1
        });
      } catch (countError) {
        console.warn("Failed to update member count, but membership was created:", countError);
      }
      
      try {
        await loadData();
      } catch (loadError) {
        console.warn("Failed to reload data, but membership was created:", loadError);
        setUserMemberships(prev => new Set([...prev, guild.id]));
        setGuilds(prev => prev.map(g => 
          g.id === guild.id 
            ? { ...g, member_count: (g.member_count || 0) + 1 }
            : g
        ));
      }
      
    } catch (error) {
      console.error("Error joining guild:", error);
      alert("Failed to join guild. Please try again.");
    }
  };

  const handleLeaveGuild = async (guild) => {
    if (!currentUser) return;
    
    const isOwner = currentUser.email === guild.created_by;
    const confirmLeave = window.confirm(
      isOwner && guild.member_count === 1
        ? "You are the last member and the owner. Leaving will archive this guild. Are you sure?"
        : "Are you sure you want to leave this guild?"
    );

    if (!confirmLeave) return;

    try {
      const membership = await GuildMembership.filter({ 
        guild_id: guild.id, 
        user_email: currentUser.email 
      });
      
      if (membership.length === 0) {
        alert("You are not a member of this guild.");
        return;
      }

      // Delete membership - this is the core operation
      await GuildMembership.delete(membership[0].id);
      
      // Update guild status - catch errors here separately
      try {
        const newMemberCount = Math.max(0, (guild.member_count || 0) - 1);
        
        if (newMemberCount === 0) {
          // Last member left, archive the guild
          await Guild.update(guild.id, { member_count: 0, is_archived: true });
        } else {
          await Guild.update(guild.id, { member_count: newMemberCount });
        }
      } catch (countError) {
        console.warn("Failed to update guild status, but membership was removed:", countError);
      }
      
      // Reload data to refresh UI - catch errors here separately
      try {
        await loadData();
      } catch (loadError) {
        console.warn("Failed to reload data, but membership was removed:", loadError);
        // Manually update the local state as fallback
        setUserMemberships(prev => {
          const newSet = new Set(prev);
          newSet.delete(guild.id);
          return newSet;
        });
        setGuilds(prev => prev.map(g => 
          g.id === guild.id 
            ? { ...g, member_count: Math.max(0, (g.member_count || 0) - 1) }
            : g
        ));
      }
      
    } catch (error) {
      console.error("Error leaving guild:", error);
      alert("Failed to leave the guild. Please try again.");
    }
  };

  const filteredGuilds = guilds.filter(guild => {
    if (guild.is_archived) return false;
    
    const matchesSearch = guild.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         guild.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = guildTypeFilter === "all" || guild.guild_type === guildTypeFilter;
    const matchesJoined = joinedGuildsFilter === "all" || 
                         (joinedGuildsFilter === "joined" && userMemberships.has(guild.id)) ||
                         (joinedGuildsFilter === "not_joined" && !userMemberships.has(guild.id));

    return matchesSearch && matchesType && matchesJoined;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Guilds</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Find and join communities of like-minded individuals.</p>
        </div>
        <Link to={createPageUrl("CreateGuild")}>
            <Button className="creator-btn w-full md:w-auto">
                <Plus className="w-5 h-5 mr-2" />
                Create Guild
            </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card className="creator-card p-4"> {/* Changed from div to Card based on outline */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search guilds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={guildTypeFilter} onValueChange={setGuildTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                  <SelectItem value="explorer">Explorer</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={joinedGuildsFilter} onValueChange={setJoinedGuildsFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Membership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Guilds</SelectItem>
                <SelectItem value="joined">Joined</SelectItem>
                <SelectItem value="not_joined">Not Joined</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Guild Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="creator-card h-64 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGuilds.map((guild, index) => {
            const isMember = userMemberships.has(guild.id);
            const isOwner = currentUser && currentUser.email === guild.created_by;

            return (
              <motion.div
                key={guild.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="creator-card h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          {guild.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={`${guildTypeColors[guild.guild_type]} capitalize`}>
                            {guild.guild_type}
                          </Badge>
                          {/* Updated Public/Private Badge */}
                          <Badge variant="outline" className="flex items-center gap-1.5 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                            {guild.is_public ? <Globe className="w-3 h-3 text-green-600" /> : <Lock className="w-3 h-3 text-red-600" />}
                            <span>{guild.is_public ? 'Public' : 'Private'}</span>
                          </Badge>
                          {isOwner && (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                              <Crown className="w-3 h-3 mr-1" />
                              Owner
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 flex-1">
                      {guild.description.length > 100 
                        ? guild.description.slice(0, 100) + "..." 
                        : guild.description}
                    </p>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{guild.member_count || 0} members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{guild.quest_count || 0} posts</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <Link to={createPageUrl("GuildDetail") + "?id=" + guild.id} className="flex-1">
                        <Button variant="outline" className="w-full creator-btn-secondary">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      {currentUser && (
                        <Button
                          onClick={() => isMember ? handleLeaveGuild(guild) : handleJoinGuild(guild)}
                          className={isMember ? 'creator-btn-secondary' : 'creator-btn'}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          {isMember ? 'Leave' : 'Join'}
                        </Button>
                      )}
                      {isOwner && (
                        <Button variant="outline" size="icon" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredGuilds.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No guilds found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm || guildTypeFilter !== "all" 
              ? "Try adjusting your search or filters" 
              : "Be the first to create a guild and bring creators together"
            }
          </p>
          <Link to={createPageUrl("CreateGuild")}> {/* Added Link to Create Guild page */}
            <Button className="creator-btn">
              <Plus className="w-5 h-5 mr-2" />
              Create Guild
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
