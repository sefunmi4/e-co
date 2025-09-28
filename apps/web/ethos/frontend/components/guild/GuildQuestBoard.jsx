import React from 'react';
import { Quest } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Target, Info } from 'lucide-react';
import QuestRequestCard from './QuestRequestCard';

export default function GuildQuestBoard({ quests, currentUser, userLikesMap, onQuestUpdate, onLikeUpdate, guildMembers }) {
  const openQuests = quests.filter(
    (q) => q.request_type !== 'none' && q.status !== 'completed' && !q.is_archived
  );

  const handleAcceptQuest = async (quest) => {
    if (!currentUser) {
      alert("Please log in to accept quests.");
      return;
    }

    // Check if user is already a collaborator
    if (quest.collaborators?.includes(currentUser.email)) {
      alert("You are already working on this quest!");
      return;
    }

    // Check if user is the quest creator
    if (quest.created_by === currentUser.email) {
      alert("You can't accept your own quest!");
      return;
    }

    // Confirm acceptance
    const confirmAccept = window.confirm(
      `Are you sure you want to join "${quest.title}" as a collaborator?`
    );
    
    if (!confirmAccept) return;

    try {
      const updatedCollaborators = [...(quest.collaborators || []), currentUser.email];
      
      await Quest.update(quest.id, {
        collaborators: updatedCollaborators,
        status: 'in_progress' // Move to in progress when someone accepts
      });

      if (onQuestUpdate) {
        onQuestUpdate();
      }

      alert("Successfully joined the quest! You're now a collaborator.");
      
    } catch (error) {
      console.error("Error accepting quest:", error);
      alert("Failed to accept the quest. Please try again.");
    }
  };

  const isGuildMember = guildMembers && currentUser && 
    guildMembers.some(member => member.user_email === currentUser.email);

  return (
    <Card className="creator-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-green-500" />
          Guild Quest Board ({openQuests.length})
        </CardTitle>
        <CardDescription>
          Open requests for help, feedback, and collaboration within the guild.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {openQuests.length > 0 ? (
          <div className="space-y-3">
            {openQuests.map((quest) => (
              <QuestRequestCard
                key={quest.id}
                quest={quest}
                onAccept={handleAcceptQuest}
                currentUser={currentUser}
                isGuildMember={isGuildMember}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Info className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold">The Quest Board is Clear!</h3>
            <p className="text-sm mt-1">There are no active requests in this guild right now.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}