
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Guild, Quest, GuildMembership, User, QuestLike } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Settings, ArrowLeft, FileText, MessageSquare, Folder, Eye, Lock, Info, User as UserIcon } from 'lucide-react'; // Added new icons
import QuestCard from '../components/dashboard/QuestCard';
import GuildQuestBoard from '../components/guild/GuildQuestBoard';
import { createPageUrl } from '@/utils';

export default function GuildDetail() {
    const [searchParams] = useSearchParams();
    const guildId = searchParams.get('id');
    const navigate = useNavigate();

    const [guild, setGuild] = useState(null);
    const [quests, setQuests] = useState([]);
    // const [activityLogs, setActivityLogs] = useState([]); // Removed as per outline
    const [currentUser, setCurrentUser] = useState(null);
    const [isMember, setIsMember] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [members, setMembers] = useState([]); // Added members state
    const [userLikesMap, setUserLikesMap] = useState(new Map());

    const loadGuildData = useCallback(async () => {
        if (!guildId) return;
        setIsLoading(true);
        try {
            const [guildData, user] = await Promise.all([
                Guild.filter({ id: guildId }),
                User.me().catch(() => null)
            ]);

            if (guildData.length > 0) {
                const currentGuild = guildData[0];
                setGuild(currentGuild);
                setCurrentUser(user);
                
                const membersData = await GuildMembership.filter({ guild_id: guildId });
                setMembers(membersData);
                
                let isUserMember = false;
                if (user) {
                    isUserMember = membersData.some(m => m.user_email === user.email);
                    setIsMember(isUserMember);
                    
                    const userLikesData = await QuestLike.filter({ user_email: user.email });
                    const likesMap = new Map(userLikesData.map(like => [like.quest_id, like]));
                    setUserLikesMap(likesMap);
                }

                // Refined quest filtering logic
                let questFilter;
                if (currentGuild.is_party) {
                    // Parties have their own content stream via party_id
                    questFilter = { party_id: guildId, is_archived: false };
                } else {
                    // For regular guilds, members see all posts, non-members see only public posts
                    if (isUserMember) {
                        questFilter = { guild_id: guildId, is_archived: false };
                    } else {
                        questFilter = { guild_id: guildId, is_public: true, is_archived: false };
                    }
                }
                
                const questsData = await Quest.filter(questFilter, "-created_date");
                setQuests(questsData);

            }
        } catch (error) {
            console.error("Error loading guild details:", error);
        }
        setIsLoading(false);
    }, [guildId]);

    useEffect(() => {
        loadGuildData();
    }, [loadGuildData]);
    
    const handleLikeUpdate = (questId, newLikeRecord) => {
        const newMap = new Map(userLikesMap);
        if (newLikeRecord) {
            newMap.set(questId, newLikeRecord);
        } else {
            newMap.delete(questId);
        }
        setUserLikesMap(newMap);
        loadGuildData();
    };

    const handleJoinLeave = async () => {
        if (!currentUser || !guild) return;

        if (isMember) {
            const isOwner = currentUser.email === guild.created_by;
            const confirmLeave = window.confirm(
                isOwner && members.length === 1
                    ? "You are the last member and the owner. Leaving will archive this guild. Are you sure?"
                    : "Are you sure you want to leave this guild?"
            );

            if (!confirmLeave) return;

            setIsLoading(true);
            try {
                const membership = await GuildMembership.filter({ guild_id: guildId, user_email: currentUser.email });
                if (membership.length === 0) {
                    alert("You are not a member of this guild.");
                    setIsLoading(false);
                    return;
                }

                // Delete membership - core operation
                await GuildMembership.delete(membership[0].id);
                
                // Update guild status - catch errors separately
                try {
                    const newMemberCount = Math.max(0, (guild.member_count || 0) - 1);
                    
                    if (newMemberCount === 0) {
                        // Last member left, archive the guild
                        await Guild.update(guild.id, { member_count: 0, is_archived: true });
                        alert("Guild has been archived.");
                        navigate(createPageUrl("Community"));
                        return;
                    } else {
                        await Guild.update(guild.id, { member_count: newMemberCount });
                    }
                } catch (updateError) {
                    console.warn("Failed to update guild status, but membership was removed:", updateError);
                }

                // Reload data - catch errors separately
                try {
                    setIsMember(false);
                    await loadGuildData();
                } catch (loadError) {
                    console.warn("Failed to reload data, but membership was removed:", loadError);
                    setIsMember(false); // Ensure state is consistent even if reload fails
                }
                
            } catch (error) {
                console.error("Error leaving guild:", error);
                alert("Failed to leave the guild. Please try again.");
            } finally {
                setIsLoading(false);
            }
        } else {
            // Join guild - add duplicate check
            setIsLoading(true);
            try {
                // Check if user is already a member
                const existingMembership = await GuildMembership.filter({ 
                    guild_id: guildId, 
                    user_email: currentUser.email 
                });
                
                if (existingMembership.length > 0) {
                    alert("You are already a member of this guild!");
                    setIsLoading(false);
                    return;
                }

                // Create membership - core operation
                await GuildMembership.create({ 
                    guild_id: guildId, 
                    user_email: currentUser.email, 
                    joined_date: new Date().toISOString() 
                });

                // Update guild member count - catch errors separately
                try {
                    await Guild.update(guild.id, { member_count: (guild.member_count || 0) + 1 });
                } catch (updateError) {
                    console.warn("Failed to update member count, but membership was created:", updateError);
                }

                // Reload data - catch errors separately
                try {
                    setIsMember(true);
                    await loadGuildData();
                } catch (loadError) {
                    console.warn("Failed to reload data, but membership was created:", loadError);
                    setIsMember(true); // Ensure state is consistent even if reload fails
                }

            } catch (error) {
                console.error("Error joining guild:", error);
                alert("Failed to join the guild. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    // handleInvite function removed as per new outline design

    const isOwner = currentUser && guild?.created_by === currentUser.email;

    if (isLoading) {
        return <div className="p-6 text-center">Loading guild details...</div>;
    }

    if (!guild) {
        return <div className="p-6 text-center">Guild not found.</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <Card className="creator-card">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Link to={createPageUrl("Community")}>
                                    <Button variant="ghost" size="icon">
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                    </Link>
                                <div>
                                    <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">
                                        {guild.name}
                                    </CardTitle>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="capitalize">
                                            {guild.guild_type}
                                        </Badge>
                                        <Badge variant="outline" className="flex items-center gap-1">
                                            {guild.is_public && !guild.is_party ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                            <span>{guild.is_public && !guild.is_party ? "Public" : "Private"}</span>
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row gap-2">
                                {currentUser && (
                                    <Button
                                        onClick={handleJoinLeave}
                                        className={isMember ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800' : 'creator-btn'}
                                        disabled={isLoading}
                                    >
                                        {isMember ? 'Leave Guild' : 'Join Guild'}
                                    </Button>
                                )}
                                {isOwner && (
                                    <Button variant="outline" disabled={isLoading}>
                                        <Settings className="w-4 h-4 mr-2" />
                                        Settings
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{guild.description}</p>
                        {guild.is_party && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm flex items-start gap-2 border border-yellow-200 dark:border-yellow-800">
                                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>This is a private Party Chat. Posts here are only visible to members and are documented as shared projects.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">

                        <GuildQuestBoard
                          quests={quests}
                          currentUser={currentUser}
                          userLikesMap={userLikesMap}
                          onQuestUpdate={loadGuildData}
                          onLikeUpdate={handleLikeUpdate}
                          guildMembers={members}
                        />

                        <Card className="creator-card">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>
                                    {guild.is_party ? "Shared Projects" : "Guild Quests"} ({quests.length})
                                </CardTitle>
                                {isMember && (
                                    <Link to={createPageUrl("CreateQuest") + `?guildId=${guild.id}`}>
                                        <Button>
                                            <Plus className="w-4 h-4 mr-2" /> Create New
                                        </Button>
                                    </Link>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {quests.length > 0 ? (
                                    quests.map(quest => (
                                        <QuestCard
                                            key={quest.id}
                                            quest={quest}
                                            currentUser={currentUser}
                                            userLike={userLikesMap.get(quest.id)}
                                            onQuestUpdate={loadGuildData}
                                            onLikeUpdate={handleLikeUpdate}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                        <h3 className="text-lg font-semibold">No Posts Yet</h3>
                                        <p className="text-sm mt-1">Be the first to share something in this {guild.is_party ? "party" : "guild"}.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-1 space-y-6">
                        <Card className="creator-card">
                            <CardHeader>
                                <CardTitle className="text-xl">Members ({members.length})</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {members.length > 0 ? (
                                    members.map(member => (
                                        <div key={member.id} className="flex items-center gap-3 text-sm">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                            <p className="text-gray-800 dark:text-gray-200">
                                                {member.user_email.split('@')[0]}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">No members yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
