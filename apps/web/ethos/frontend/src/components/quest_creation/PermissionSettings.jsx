import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Users, UserPlus, X, Shield, Eye, Lock } from 'lucide-react';

export default function PermissionSettings({ questType, questData, onUpdate, currentUser }) {
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('member');

  const isPartyFolder = questType === 'party_folder';
  const isGuildRepo = questType === 'guild_repo';
  const isClubFolder = questType === 'club_folder';
  
  const maxMembers = isPartyFolder ? 8 : undefined;
  const currentMembers = questData.folder_permissions?.members || [];

  const handleAddMember = () => {
    if (!memberEmail.trim() || memberEmail === currentUser?.email) return;
    
    if (maxMembers && currentMembers.length >= maxMembers) {
      alert(`Maximum ${maxMembers} members allowed`);
      return;
    }

    const updatedPermissions = {
      ...questData.folder_permissions,
      members: [...currentMembers, memberEmail.trim()],
      [memberRole === 'admin' ? 'can_add' : 'can_edit']: [
        ...(questData.folder_permissions?.[memberRole === 'admin' ? 'can_add' : 'can_edit'] || []),
        memberEmail.trim()
      ]
    };

    onUpdate({
      ...questData,
      folder_permissions: updatedPermissions
    });

    setMemberEmail('');
    setMemberRole('member');
  };

  const handleRemoveMember = (emailToRemove) => {
    const updatedPermissions = {
      ...questData.folder_permissions,
      members: currentMembers.filter(email => email !== emailToRemove),
      can_add: questData.folder_permissions?.can_add?.filter(email => email !== emailToRemove) || [],
      can_edit: questData.folder_permissions?.can_edit?.filter(email => email !== emailToRemove) || [],
      can_delete: questData.folder_permissions?.can_delete?.filter(email => email !== emailToRemove) || []
    };

    onUpdate({
      ...questData,
      folder_permissions: updatedPermissions
    });
  };

  const handlePrivacyChange = (isPublic) => {
    onUpdate({
      ...questData,
      is_public: isPublic
    });
  };

  const handleRequestVisibilityChange = (visibility) => {
    onUpdate({
      ...questData,
      request_visibility: visibility
    });
  };

  if (!isPartyFolder && !isGuildRepo && !isClubFolder) {
    // Simple privacy settings for discussions and project files
    return (
      <Card className="creator-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Label htmlFor="is_public" className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
              {questData.is_public ? <Eye className="w-4 h-4 text-green-600"/> : <Lock className="w-4 h-4 text-orange-600" />}
              <span>{questData.is_public ? "Public Post" : "Private Post"}</span>
            </Label>
            <Switch
              id="is_public"
              checked={questData.is_public}
              onCheckedChange={handlePrivacyChange}
            />
          </div>

          {questData.request_type !== 'none' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Request Visibility
              </Label>
              <Select value={questData.request_visibility || 'public'} onValueChange={handleRequestVisibilityChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Who can see your request" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Anyone can respond</SelectItem>
                  <SelectItem value="followers_only">Followers Only</SelectItem>
                  <SelectItem value="party_only">Party Members Only</SelectItem>
                  <SelectItem value="guild_only">Guild Members Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="creator-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          {isPartyFolder && 'Party Members'}
          {isGuildRepo && 'Guild Permissions'}
          {isClubFolder && 'Club Settings'}
          {maxMembers && (
            <Badge variant="outline" className="ml-2">
              {currentMembers.length}/{maxMembers} members
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Privacy Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Label htmlFor="folder_public" className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
            {questData.is_public ? <Eye className="w-4 h-4 text-green-600"/> : <Lock className="w-4 h-4 text-orange-600" />}
            <span>{questData.is_public ? "Public Folder" : "Private Folder"}</span>
          </Label>
          <Switch
            id="folder_public"
            checked={questData.is_public}
            onCheckedChange={handlePrivacyChange}
          />
        </div>

        {/* Add Members */}
        {(!maxMembers || currentMembers.length < maxMembers) && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Add Members
            </Label>
            <div className="flex gap-2">
              <Input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="Enter email address..."
                className="flex-1"
              />
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddMember} className="creator-btn">
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Current Members */}
        {currentMembers.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Members
            </Label>
            <div className="space-y-2">
              {currentMembers.map((email) => {
                const canEdit = questData.folder_permissions?.can_edit?.includes(email);
                const canAdd = questData.folder_permissions?.can_add?.includes(email);
                const isAdmin = canAdd || canEdit;
                
                return (
                  <div key={email} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{email}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {isAdmin ? 'Admin' : 'Member'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(email)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leader Assignment for Party Folders */}
        {isPartyFolder && currentMembers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Party Leader
            </Label>
            <Select 
              value={questData.folder_permissions?.party_leader || currentUser?.email} 
              onValueChange={(leader) => onUpdate({
                ...questData,
                folder_permissions: {
                  ...questData.folder_permissions,
                  party_leader: leader
                }
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select party leader" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentUser?.email || ''}>
                  {currentUser?.email} (You)
                </SelectItem>
                {currentMembers.map(email => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}