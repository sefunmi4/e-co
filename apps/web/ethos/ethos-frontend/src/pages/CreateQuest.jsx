
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Quest, User, QuestLog, Guild, QuestComment } from "@/api/entities"; // Added Guild and QuestComment import
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectFileEditor from "../components/quest_creation/ProjectFileEditor";
import {
  ArrowLeft,
  Upload,
  Folder,
  FileText,
  X,
  Plus,
  Github,
  MessageSquare,
  Link as LinkIcon,
  Youtube,
  Instagram,
  Clapperboard,
  Globe,
  Lock,
  Save,
  Star,
  Users as UsersIcon, // Renamed to avoid conflict
  Info, // Added for info message
  Shield, // Added for permissions section
} from "lucide-react";

const TypeSelector = ({ selectedType, onSelectType, disabled, isInsidePartyFolder }) => {
  const types = [
    { value: 'discussion', label: 'Discussion', icon: MessageSquare },
    { value: 'project_quest', label: 'Quest', icon: FileText },
    { value: 'party_folder', label: 'Party Folder', icon: Folder },
  ];

  return (
    <div className="flex gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {types.map(({ value, label, icon: Icon }) => {
        const itemDisabled = isInsidePartyFolder && value === 'party_folder';
        return (
          <button
            key={value}
            type="button"
            onClick={() => !disabled && !itemDisabled && onSelectType(value)}
            disabled={disabled || itemDisabled}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedType === value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
            } ${disabled || itemDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

const VisibilitySelector = ({ selectedVisibility, onSelectVisibility, disabled }) => {
  const visibilities = [
    { value: 'public', label: 'Public', icon: Globe },
    { value: 'followers', label: 'Followers', icon: UsersIcon },
    { value: 'private', label: 'Private', icon: Lock },
  ];

  return (
    <div className="flex gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
      {visibilities.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => !disabled && onSelectVisibility(value)}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            selectedVisibility === value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
};


export default function CreateQuest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parent');
  const guildId = searchParams.get('guildId'); // For creating quests inside a guild/party
  const linkDiscussionId = searchParams.get('linkDiscussion');
  const editId = searchParams.get('editId'); // For editing existing quests
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);

  const [questData, setQuestData] = useState({
    title: "",
    description: "",
    quest_type: parentId ? "project_quest" : "discussion",
    visibility: "public", // Default to public
    party_id: guildId || null, // This will be set more accurately in handleSubmit
    tags: [],
    file_urls: [],
    github_url: "",
    project_markdown: "", // New field for project quests
    content_text: "", // For generic file types
    parent_quest_id: parentId || "",
    linked_discussion_id: linkDiscussionId || "",
    youtube_url: "",
    tiktok_url: "",
    instagram_url: "",
    allow_reviews: false, // Add this field
    team_permissions: { // New permissions object
      can_edit_files: true,
      can_add_comments: true,
      can_edit_description: false,
      can_add_content: true, // New permission for adding content to folders
      public_can_comment: true
    }
  });
  const [originalData, setOriginalData] = useState(null); // For tracking changes during edit
  const [currentTag, setCurrentTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [linkedDiscussion, setLinkedDiscussion] = useState(null);
  const [parentQuest, setParentQuest] = useState(null);
  const [currentGuild, setCurrentGuild] = useState(null); // To store guild info
  const [isCreator, setIsCreator] = useState(false);
  const [isCollaborator, setIsCollaborator] = useState(false);

  const isEditing = !!editId;

  // New useEffect: Load linked discussion data if linkDiscussionId is present
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);

        if (parentId) {
          const parentQuests = await Quest.filter({ id: parentId });
          if (parentQuests.length > 0) {
            setParentQuest(parentQuests[0]);
          }
        }
        
        if (guildId) { // Fetch guild data if creating inside a guild
            const guildResult = await Guild.filter({ id: guildId });
            if (guildResult.length > 0) {
                setCurrentGuild(guildResult[0]);
            }
        }
        
        if (editId) {
          // Editing mode
          const quests = await Quest.filter({ id: editId });
          if (quests.length > 0) {
            const questToEdit = quests[0];
            const creator = user.email === questToEdit.created_by;
            const collaborator = !creator && questToEdit.collaborators?.includes(user.email);
            
            setIsCreator(creator);
            setIsCollaborator(collaborator);

            if (creator || collaborator) {
              const data = {
                title: questToEdit.title || "",
                description: questToEdit.description || "",
                quest_type: questToEdit.quest_type,
                visibility: questToEdit.visibility || 'public',
                party_id: questToEdit.party_id || null,
                tags: questToEdit.tags || [],
                file_urls: questToEdit.file_urls || [],
                github_url: questToEdit.github_url || "",
                project_markdown: questToEdit.project_markdown || "", // Load project_markdown
                content_text: questToEdit.content_text || "",
                parent_quest_id: questToEdit.parent_quest_id || "",
                linked_discussion_id: questToEdit.linked_discussion_id || "",
                youtube_url: questToEdit.youtube_url || "",
                tiktok_url: questToEdit.tiktok_url || "",
                instagram_url: questToEdit.instagram_url || "",
                allow_reviews: questToEdit.allow_reviews || false, // Load allow_reviews
                team_permissions: questToEdit.team_permissions || {
                  can_edit_files: true,
                  can_add_comments: true,
                  can_edit_description: false,
                  can_add_content: true, // Default for existing if not present
                  public_can_comment: true
                }
              };
              setQuestData(data);
              setOriginalData(data);
            } else {
              // User is neither creator nor collaborator
              setIsCreator(false);
              setIsCollaborator(false);
            }
          }
        } else {
          // Creating mode
          const defaultVisibility = user?.default_post_privacy || 'public'; 
          setQuestData(prev => ({ ...prev, visibility: defaultVisibility }));

          if (linkDiscussionId) {
            // Assuming Quest.filter is available to fetch quests by ID
            const discussions = await Quest.filter({ id: linkDiscussionId });
            if (discussions.length > 0) {
              const discussion = discussions[0];
              setLinkedDiscussion(discussion);
              setQuestData(prev => ({
                ...prev,
                title: discussion.title + " (File Version)", // Pre-fill title
                description: `This file is a repost of @${discussion.created_by?.split('@')[0] || 'unknown'} discussion "${discussion.title}"\n\nOriginal discussion: ${discussion.description}`, // Pre-fill description
                quest_type: "file", // Force type to file
                linked_discussion_id: discussion.id,
                content_text: discussion.content_text || discussion.description, // Use content_text or description from original
                visibility: discussion.visibility || 'public' // Inherit privacy from original
              }));
            } else {
              console.warn("Linked discussion not found:", linkDiscussionId);
              // Optionally, clear linkDiscussionId or redirect if not found
            }
          }
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    };
    loadInitialData();
  }, [editId, linkDiscussionId, parentId, guildId]); // Added guildId dependency

  // Determine if we are linking a discussion (used for type and text changes)
  const isLinkingDiscussion = !!linkDiscussionId; 
  const isInPartyOrGuild = !!guildId;

  const handleInputChange = useCallback((field, value) => {
    if (field.startsWith('team_permissions.')) {
      const permissionKey = field.split('.')[1];
      setQuestData(prev => ({
        ...prev,
        team_permissions: {
          ...prev.team_permissions,
          [permissionKey]: value
        }
      }));
    } else {
      setQuestData(prev => ({ ...prev, [field]: value }));
    }
  }, []);

  const handleTypeChange = useCallback((type) => {
    if (type === 'project_quest' && !questData.project_markdown) {
      handleInputChange('project_markdown', '- [ ] '); // Initialize with a basic todo item
    }
    handleInputChange('quest_type', type);
  }, [questData.project_markdown, handleInputChange]);

  const handleAddTag = () => {
    if (currentTag.trim() && !questData.tags.includes(currentTag.trim())) {
      setQuestData(prev => ({ ...prev, tags: [...prev.tags, currentTag.trim()] }));
      setCurrentTag("");
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingFiles(true);
    
    try {
      const uploadPromises = files.map(file => UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map(result => result.file_url);

      setQuestData(prev => ({
        ...prev,
        file_urls: [...prev.file_urls, ...fileUrls]
      }));
    } catch (error) {
      console.error("Error uploading files:", error);
    }
    setUploadingFiles(false);
  };

  const createChangeLog = async (changes) => {
    if (!currentUser || changes.length === 0) return;

    const changeMessages = changes.map(change => 
      `@${currentUser.email.split('@')[0]} changed ${change.field} from "${change.from}" to "${change.to}"`
    );

    for (const message of changeMessages) {
      await QuestLog.create({
        quest_id: editId,
        action_type: "updated",
        message: message,
        user_email: currentUser.email,
        metadata: { edit_timestamp: new Date().toISOString() }
      });
    }
  };

  const detectChanges = () => {
    const changes = [];
    if (!originalData) return changes;

    Object.keys(questData).forEach(key => {
      const originalValue = originalData[key];
      const currentValue = questData[key];
      
      // Simple comparison for primitives
      if (typeof originalValue !== 'object' && originalValue !== currentValue) {
        changes.push({ field: key, from: String(originalValue).slice(0, 50), to: String(currentValue).slice(0, 50) });
      } 
      // Comparison for arrays (tags, file_urls)
      else if (Array.isArray(originalValue) && JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
         changes.push({ field: key, from: `[${originalValue.length} items]`, to: `[${currentValue.length} items]` });
      }
      // Comparison for objects (team_permissions) - simple stringify for change log
      else if (typeof originalValue === 'object' && originalValue !== null && !Array.isArray(originalValue) && JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
        changes.push({ field: key, from: `object`, to: `object` }); // More detailed logging would require deep comparison
      }
    });

    return changes;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        let updatePayload = questData;
        
        // If user is a collaborator, only allow them to update the project markdown
        if (isCollaborator) {
          updatePayload = {
            project_markdown: questData.project_markdown,
          };

          // Auto-generate a comment when collaborator edits files
          if (currentUser && originalData && questData.project_markdown !== originalData.project_markdown) {
            // Create a comment notifying about the file edit
            await QuestComment.create({
              quest_id: editId,
              user_email: currentUser.email,
              comment_text: `@${currentUser.email.split('@')[0]} updated the project to-do list`,
              // Don't include a rating - this is just an activity comment
            });
          }
        }
        
        const changes = detectChanges();
        await Quest.update(editId, updatePayload);
        if (changes.length > 0 && isCreator) { // Only log detailed changes for creators
          await createChangeLog(changes);
        }
        navigate(createPageUrl("QuestDetail") + "?id=" + editId);
      } else {
        const finalQuestData = { ...questData };
        if (currentGuild) {
            finalQuestData.guild_id = guildId; // Assign to guild
            if (currentGuild.is_party) {
                finalQuestData.party_id = guildId; // Also assign to party if it is one
                finalQuestData.visibility = 'private'; // Parties are always private
            } else if (!currentGuild.is_public) {
                finalQuestData.visibility = 'private'; // Posts in private guilds are private
            }
        }
        
        const newQuest = await Quest.create(finalQuestData);

        // Auto-generate comment when team member adds content to party folder
        if (parentId && parentQuest && currentUser) {
          const isParentCreator = currentUser.email === parentQuest.created_by;
          const isTeamMember = parentQuest.collaborators?.includes(currentUser.email);
          
          // Only generate comment if user is a team member (not the creator)
          if (!isParentCreator && isTeamMember) {
            const contentTypeText = questData.quest_type === 'discussion' ? 'discussion' : 
                                   questData.quest_type === 'project_quest' ? 'quest' : 'content';
            
            await QuestComment.create({
              quest_id: parentId,
              user_email: currentUser.email,
              comment_text: `@${currentUser.email.split('@')[0]} added new ${contentTypeText}: "${questData.title}"`,
              // Don't include a rating - this is just an activity comment
            });
          }
        }

        // Increment quest_count if created in a guild
        if (guildId) {
            try {
                const guilds = await Guild.filter({ id: guildId });
                if (guilds.length > 0) {
                    const guild = guilds[0];
                    await Guild.update(guildId, { quest_count: (guild.quest_count || 0) + 1 });
                }
            } catch (error) {
                console.error("Failed to update guild quest count:", error);
            }
        }
        
        // New: If this is a file repost of a discussion, update the original discussion
        if (linkDiscussionId && linkedDiscussion) {
          // Assuming Quest.update is available to update an existing quest
          await Quest.update(linkDiscussionId, {
            parent_quest_id: newQuest.id // Link the original discussion to the new file post
          });
        }
        
        if (guildId) {
          navigate(createPageUrl("GuildDetail") + "?id=" + guildId);
        } else if (parentId) {
          navigate(createPageUrl("QuestDetail") + "?id=" + parentId);
        } else {
          navigate(createPageUrl("Dashboard"));
        }
      }
    } catch (error) {
      console.error("Error submitting post:", error);
    }
    setIsSubmitting(false);
  };

  const getPostTypeLabel = () => {
    switch (questData.quest_type) {
      case "discussion": return "Discussion";
      case "project_quest": return "Quest";
      case "party_folder": return "Party Folder";
      case "file": return "File"; // Explicitly handle 'file' type if it's forced
      default: return "Post";
    }
  };

  const isInContainer = !!parentId;
  
  if (isEditing && !isCreator && !isCollaborator) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have permission to edit this post.</p>
          <Button onClick={() => navigate(-1)} className="creator-btn">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const canEditAllFields = !isEditing || isCreator;
  const canEditPermissions = !isEditing || isCreator; // Only creators can edit permissions

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 h-8 w-8 md:h-10 md:w-10"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {isEditing ? "Edit Post" :
               isLinkingDiscussion ? "Create File from Discussion" : 
               isInPartyOrGuild ? "Create Party Post" :
               isInContainer ? "Add to Container" : "Create New Post"}
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              {isEditing ? "Make changes to your post. All edits will be tracked." :
               isLinkingDiscussion 
                ? "Convert your discussion into a structured file post"
                : isInPartyOrGuild
                ? "Share within your party"
                : isInContainer 
                ? "Add files, folders, or discussions to this container"
                : "Share your work, ideas, or start a quest"}
            </p>
          </div>
        </div>

        {isCollaborator && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg relative mb-6 flex items-start gap-3" role="alert">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5"/>
            <div>
              <strong className="font-bold">Collaborator Mode:</strong>
              <span className="block sm:inline ml-1">You can only edit the project's to-do list. Other fields are locked.</span>
            </div>
          </div>
        )}

        {isLinkingDiscussion && linkedDiscussion && (
          <Card className="creator-card mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-blue-600" />
                Linking to Discussion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">{linkedDiscussion.title}</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {linkedDiscussion.description.length > 200 
                    ? linkedDiscussion.description.slice(0, 200) + "..." 
                    : linkedDiscussion.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {!isEditing && ( // Only show type selector when creating, not editing
            <Card className="creator-card">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-lg md:text-xl">
                  What would you like to create?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TypeSelector 
                  selectedType={questData.quest_type} 
                  onSelectType={handleTypeChange}
                  disabled={isLinkingDiscussion || isEditing}
                  isInsidePartyFolder={parentQuest?.quest_type === 'party_folder'}
                />
                {parentQuest?.quest_type === 'party_folder' && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 rounded-lg flex items-center gap-3 text-sm">
                    <Info className="w-5 h-5 flex-shrink-0" />
                    <span>You cannot create a Party Folder inside another Party Folder.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-3 text-lg md:text-xl">
                {questData.quest_type === 'discussion' ? (
                  <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                ) : questData.quest_type === 'party_folder' ? (
                  <Folder className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                ) : ( // This handles 'project_quest' and 'file' types
                  <FileText className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                )}
                {isEditing ? "Edit " : "New "}{getPostTypeLabel()}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
               <div className="space-y-2">
                <Label>Visibility</Label>
                <VisibilitySelector
                  selectedVisibility={questData.visibility}
                  onSelectVisibility={(value) => handleInputChange('visibility', value)}
                  disabled={isInPartyOrGuild || !canEditAllFields}
                />
                {isInPartyOrGuild && (
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 pt-1">
                    Posts in a party or private guild are always private to members.
                  </p>
                )}
              </div>
              <Input
                value={questData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder={
                  questData.quest_type === 'party_folder' ? "Folder name (e.g., 'Project Phoenix Assets')..." :
                  questData.quest_type === 'project_quest' ? "Quest name (e.g., 'Develop new landing page')..." :
                  "Give your post a clear, descriptive title..."
                }
                className="text-base md:text-lg font-medium border-0 border-b-2 border-gray-200 focus:border-gray-400 shadow-none rounded-none px-1 py-2 md:py-3"
                required
                disabled={!canEditAllFields}
              />
              <Textarea
                value={questData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder={
                  questData.quest_type === 'party_folder' ? "Explain the purpose of this folder..." :
                  questData.quest_type === 'project_quest' ? "Describe the quest's goals, scope, and context..." :
                  "Share your thoughts, ask questions, or start a discussion..."
                }
                rows={4}
                className="bg-gray-50 border-gray-200 text-gray-900 resize-none text-sm md:text-base"
                required
                disabled={!canEditAllFields}
              />

              {/* General Settings for reviews */}
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <Label htmlFor="allow_reviews" className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-200">
                    <Star className="w-4 h-4 text-yellow-500"/>
                    <span>Allow Reviews on Completion</span>
                  </Label>
                  <Switch
                    id="allow_reviews"
                    checked={questData.allow_reviews}
                    onCheckedChange={(checked) => handleInputChange('allow_reviews', checked)}
                    disabled={!canEditAllFields}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Enable this if you want others to be able to rate and review this post once it's marked as complete.
                </p>
              </div>

              {questData.quest_type === 'project_quest' && (
                <ProjectFileEditor
                  value={questData.project_markdown}
                  onChange={(value) => handleInputChange('project_markdown', value)}
                />
              )}

              {questData.quest_type === 'file' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Content (optional)</label>
                  <Textarea
                    value={questData.content_text}
                    onChange={(e) => handleInputChange("content_text", e.target.value)}
                    placeholder="Write your file content, or add more details here..."
                    rows={12}
                    className="bg-white border-gray-200 text-gray-900 resize-none font-mono text-sm"
                    disabled={!canEditAllFields}
                  />
                </div>
              )}

              {questData.file_urls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Attachments:</p>
                  <div className="grid gap-2">
                    {questData.file_urls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span>File {index + 1}</span>
                        </div>
                        <Button 
                          type="button" 
                          size="icon" 
                          variant="ghost"
                          onClick={() => {
                            const newUrls = questData.file_urls.filter((_, i) => i !== index);
                            handleInputChange("file_urls", newUrls);
                          }}
                          disabled={!canEditAllFields}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="creator-btn-secondary text-sm"
                      disabled={uploadingFiles || !canEditAllFields}
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingFiles ? "Uploading..." : "Upload Files"}
                    </button>
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="creator-btn-secondary text-sm"
                      disabled={uploadingFiles || !canEditAllFields}
                    >
                      <Folder className="w-4 h-4" />
                      {uploadingFiles ? "Uploading..." : "Upload Folder"}
                    </button>
                    <input 
                      ref={fileInputRef} 
                      type="file" 
                      multiple 
                      onChange={(e) => handleFileUpload(e)} 
                      className="hidden" 
                    />
                    <input 
                      ref={folderInputRef} 
                      type="file" 
                      onChange={(e) => handleFileUpload(e)} 
                      className="hidden" 
                      {...({webkitdirectory: ""})}
                    />
                </div>
                <div className="relative">
                     <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                     <Input
                        placeholder="Link GitHub repository... (optional)"
                        value={questData.github_url}
                        onChange={(e) => handleInputChange('github_url', e.target.value)}
                        className="pl-10"
                        disabled={!canEditAllFields}
                    />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Permissions - Now includes 'party_folder' */}
          {(questData.quest_type === 'project_quest' || questData.quest_type === 'party_folder') && canEditPermissions && (
            <Card className="creator-card">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  Team Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {questData.quest_type === 'party_folder' ? 
                    "Control what your team members can do within this folder workspace." :
                    "Control what your team members and public viewers can do. These settings will apply to items inside this folder."
                  }
                </p>
                
                <div className="space-y-4">
                  {questData.quest_type === 'party_folder' && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                      <div>
                        <Label className="font-medium text-gray-900 dark:text-gray-200">Team can add content</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Allow team members to create new posts, files, and discussions in this folder</p>
                      </div>
                      <Switch
                        checked={questData.team_permissions.can_add_content}
                        onCheckedChange={(checked) => handleInputChange('team_permissions.can_add_content', checked)}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="font-medium text-gray-900 dark:text-gray-200">Team can edit files</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Allow team members to edit the project to-do list and files</p>
                    </div>
                    <Switch
                      checked={questData.team_permissions.can_edit_files}
                      onCheckedChange={(checked) => handleInputChange('team_permissions.can_edit_files', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="font-medium text-gray-900 dark:text-gray-200">Team can add comments</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Allow team members to leave comments and reviews</p>
                    </div>
                    <Switch
                      checked={questData.team_permissions.can_add_comments}
                      onCheckedChange={(checked) => handleInputChange('team_permissions.can_add_comments', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="font-medium text-gray-900 dark:text-gray-200">Team can edit description</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Allow team members to modify the project description and details</p>
                    </div>
                    <Switch
                      checked={questData.team_permissions.can_edit_description}
                      onCheckedChange={(checked) => handleInputChange('team_permissions.can_edit_description', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="font-medium text-gray-900 dark:text-gray-200">Public can comment</Label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Allow anyone to leave comments on this project</p>
                    </div>
                    <Switch
                      checked={questData.team_permissions.public_can_comment}
                      onCheckedChange={(checked) => handleInputChange('team_permissions.public_can_comment', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white text-lg">Link Social Content (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="relative">
                <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                <Input
                  placeholder="YouTube URL"
                  value={questData.youtube_url}
                  onChange={(e) => handleInputChange('youtube_url', e.target.value)}
                  className="pl-10"
                  disabled={!canEditAllFields}
                />
              </div>
              <div className="relative">
                <Clapperboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500" />
                <Input
                  placeholder="TikTok URL"
                  value={questData.tiktok_url}
                  onChange={(e) => handleInputChange('tiktok_url', e.target.value)}
                  className="pl-10"
                  disabled={!canEditAllFields}
                />
              </div>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500" />
                <Input
                  placeholder="Instagram URL"
                  value={questData.instagram_url}
                  onChange={(e) => handleInputChange('instagram_url', e.target.value)}
                  className="pl-10"
                  disabled={!canEditAllFields}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white text-lg">Add Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Help others discover your work</p>
              <div className="flex gap-2 mb-3">
                <Input
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  placeholder="Add tag..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  className="bg-gray-50 border-gray-200"
                  disabled={!canEditAllFields}
                />
                <Button type="button" onClick={handleAddTag} className="creator-btn-secondary" disabled={!canEditAllFields}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {questData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                    {tag}
                    <button 
                      type="button" 
                      onClick={() => setQuestData(prev => ({ 
                        ...prev, 
                        tags: prev.tags.filter(t => t !== tag) 
                      }))} 
                      className="ml-1.5"
                      disabled={!canEditAllFields}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3 md:gap-4">
            <button 
              type="button" 
              onClick={() => navigate(-1)} 
              className="creator-btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="creator-btn"
            >
              {isEditing ? <Save className="w-4 h-4 mr-2" /> : null}
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : 
               isEditing ? "Save Changes" :
               isLinkingDiscussion ? "Create File Version" : 
               isInPartyOrGuild ? "Create Party Post" :
               isInContainer ? "Add to Container" : "Create Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
