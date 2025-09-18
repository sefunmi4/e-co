import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  Eye, 
  MessageSquare, 
  FileText, 
  Users, 
  Clock,
  CheckCircle,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const requestTypeConfig = {
  team_help: {
    icon: UserPlus,
    label: 'Team Help',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    actionText: 'Join Team'
  },
  feedback: {
    icon: Eye,
    label: 'Feedback',
    color: 'bg-green-100 text-green-700 border-green-200',
    actionText: 'Give Feedback'
  }
};

const questTypeIcons = {
  discussion: MessageSquare,
  project_quest: FileText,
  party_folder: Users
};

export default function QuestRequestCard({ quest, onAccept, currentUser, isGuildMember }) {
  const config = requestTypeConfig[quest.request_type];
  const QuestIcon = questTypeIcons[quest.quest_type] || FileText;
  const RequestIcon = config?.icon || UserPlus;

  const canAccept = isGuildMember && 
                   currentUser && 
                   quest.created_by !== currentUser.email && 
                   !quest.collaborators?.includes(currentUser.email);

  const isCollaborating = quest.collaborators?.includes(currentUser?.email);

  return (
    <Card className="creator-card hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <QuestIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <Badge className={config?.color || 'bg-gray-100 text-gray-700'}>
                <RequestIcon className="w-3 h-3 mr-1" />
                {config?.label || 'Request'}
              </Badge>
              {quest.status === 'in_progress' && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  <Star className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              )}
            </div>

            <Link 
              to={createPageUrl("QuestDetail") + "?id=" + quest.id}
              className="block hover:text-blue-600 transition-colors"
            >
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                {quest.title}
              </h4>
            </Link>

            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
              {quest.description}
            </p>

            {/* Team Roles for team_help requests */}
            {quest.request_type === 'team_help' && quest.team_roles && quest.team_roles.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {quest.team_roles.slice(0, 2).map((role, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {role.count} {role.role_type}{role.count > 1 ? 's' : ''}
                  </Badge>
                ))}
                {quest.team_roles.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{quest.team_roles.length - 2} more
                  </Badge>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>@{quest.created_by?.split('@')[0]}</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{format(new Date(quest.created_date), "MMM d")}</span>
              </div>
              {quest.collaborators && quest.collaborators.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{quest.collaborators.length + 1} member{quest.collaborators.length > 0 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {canAccept ? (
              <Button
                onClick={() => onAccept(quest)}
                className="creator-btn text-sm px-4 py-2"
                size="sm"
              >
                <RequestIcon className="w-4 h-4 mr-2" />
                {config?.actionText || 'Join'}
              </Button>
            ) : isCollaborating ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Joined</span>
              </div>
            ) : null}

            <Link to={createPageUrl("QuestDetail") + "?id=" + quest.id}>
              <Button variant="outline" size="sm" className="text-xs">
                View Details
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}