import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, CheckSquare, Folder, Database, FolderTree } from 'lucide-react';

const postTypes = [
  {
    type: 'discussion',
    title: 'Discussion Post',
    description: 'General posts for ideas, questions, and conversations',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
    available: ['home_feed', 'replies', 'create_page']
  },
  {
    type: 'project_file',
    title: 'Project File',
    description: 'Todo list and project tracking with markdown checkboxes',
    icon: CheckSquare,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/50',
    available: ['home_feed', 'create_page', 'party_folder', 'guild_repo']
  },
  {
    type: 'party_folder',
    title: 'Party Folder',
    description: 'Private collaboration space for up to 8 members',
    icon: Folder,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
    available: ['create_page'],
    maxMembers: 8
  },
  {
    type: 'club_folder',
    title: 'Club Folder',
    description: 'Guild subfolder for organizing party folders',
    icon: FolderTree,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/50',
    available: ['guild_repo'],
    adminOnly: true
  },
  {
    type: 'guild_repo',
    title: 'Guild Repository',
    description: 'Top-level guild container for all guild content',
    icon: Database,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/50',
    available: ['create_page'],
    guildMasterOnly: true
  }
];

export default function PostTypeSelector({ selectedType, onSelectType, context = 'home_feed', userRole = 'member' }) {
  const availableTypes = postTypes.filter(type => {
    // Filter based on context
    if (!type.available.includes(context)) return false;
    
    // Filter based on user permissions
    if (type.adminOnly && !['admin', 'master'].includes(userRole)) return false;
    if (type.guildMasterOnly && userRole !== 'master') return false;
    
    return true;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableTypes.map(type => {
        const Icon = type.icon;
        const isSelected = selectedType === type.type;
        
        return (
          <Card
            key={type.type}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              isSelected 
                ? 'ring-2 ring-blue-500 dark:ring-blue-400' 
                : 'hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            onClick={() => onSelectType(type.type)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg ${type.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${type.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {type.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {type.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {type.maxMembers && (
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                        Max {type.maxMembers} members
                      </span>
                    )}
                    {type.adminOnly && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                        Admin Only
                      </span>
                    )}
                    {type.guildMasterOnly && (
                      <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded">
                        Guild Master Only
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}