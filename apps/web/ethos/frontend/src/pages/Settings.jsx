
import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Quest } from "@/api/entities"; // Added Quest import
import { format } from "date-fns"; // Added format import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  User as UserIcon, 
  Palette, 
  Shield, // Shield is used for Privacy & Sharing AND Account Management. No new import needed.
  Plus, 
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Lightbulb 
} from "lucide-react";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    title: "",
    bio: "",
    skills: [],
    user_type: "explorer",
    default_post_privacy: "public", // Changed default to public
    theme_mode: "system",
    use_role_colors: true,
    privacy_settings: {
      profile_visibility: "public",
      show_email: false,
      allow_direct_messages: true,
      show_activity: true
    }
  });
  const [newSkill, setNewSkill] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, message: "" });
  const [showDeactivateModal, setShowDeactivateModal] = useState(false); // New state for deactivation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false); // New state for deletion modal

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setUser(userData);
      setFormData({
        username: userData.username || "",
        full_name: userData.full_name || "",
        title: userData.title || "",
        bio: userData.bio || "",
        skills: userData.skills || [],
        user_type: userData.user_type || "explorer",
        default_post_privacy: userData.default_post_privacy || "public", // Default to public if not set
        theme_mode: userData.theme_mode || "system",
        use_role_colors: userData.use_role_colors !== false,
        privacy_settings: {
          profile_visibility: userData.privacy_settings?.profile_visibility || "public",
          show_email: userData.privacy_settings?.show_email || false,
          allow_direct_messages: userData.privacy_settings?.allow_direct_messages !== false,
          show_activity: userData.privacy_settings?.show_activity !== false
        }
      });
    } catch (error) {
      console.error("Error loading user data:", error);
      // Optionally, handle error state or redirect
    }
    setIsLoading(false);
  };

  const validateUsername = (username) => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, message: "" });
      return false;
    }

    if (username === user?.username) {
      setUsernameStatus({ checking: false, available: true, message: "Current username" });
      return true;
    }

    // Basic username validation
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      setUsernameStatus({ 
        checking: false, 
        available: false, 
        message: "Username can only contain letters, numbers, underscores, and hyphens" 
      });
      return false;
    }

    // For now, assume it's available and let the server handle uniqueness validation
    setUsernameStatus({
      checking: false,
      available: true,
      message: "Username format looks good"
    });
    return true;
  };

  const handleUsernameChange = (value) => {
    setFormData(prev => ({ ...prev, username: value }));
    
    // Clear any existing timeout
    clearTimeout(window.usernameCheckTimeout);
    
    // Debounce the validation
    window.usernameCheckTimeout = setTimeout(() => {
      validateUsername(value);
    }, 300);
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation before saving
    if (formData.username && formData.username !== user?.username) {
      if (!validateUsername(formData.username)) {
        alert("Please choose a valid username before saving.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await User.updateMyUserData(formData);
      alert("Settings saved successfully!");
      loadUserData(); // Reload to get updated data
    } catch (error) {
      console.error("Error saving settings:", error);
      if (error.message && error.message.includes("username")) {
        alert("That username is already taken. Please choose a different one.");
      } else {
        alert("Error saving settings. Please try again.");
      }
    }
    setIsSaving(false);
  };

  const restartTutorial = async () => {
    try {
      await User.updateMyUserData({
        tutorial_completed: false,
        tutorial_progress: {
          dashboard: false,
          workspace: false,
          create: false,
          community: false,
          activity: false
        }
      });
      alert("Tutorial reset! You'll see it again when you visit each page.");
      loadUserData(); // Reload user data to reflect the change immediately
    } catch (error) {
      console.error("Error resetting tutorial:", error);
      alert("Error resetting tutorial. Please try again.");
    }
  };

  const handleDeactivateAccount = async () => {
    try {
      // Update account status to deactivated
      await User.updateMyUserData({
        account_status: 'deactivated',
        deactivated_date: new Date().toISOString()
      });

      // Make all posts private
      // Assuming user.email is how we identify posts for a user
      if (user && user.email) {
        const userQuests = await Quest.filter({ created_by: user.email });
        await Promise.all(
          userQuests.map(quest => 
            Quest.update(quest.id, { is_public: false })
          )
        );
      }

      alert("Your account has been deactivated. All your posts are now private.");
      setShowDeactivateModal(false);
      loadUserData();
    } catch (error) {
      console.error("Error deactivating account:", error);
      alert("Error deactivating account. Please try again.");
    }
  };

  const handleScheduleDeletion = async () => {
    try {
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

      await User.updateMyUserData({
        account_status: 'pending_deletion',
        deletion_scheduled_date: deletionDate.toISOString()
      });

      alert("Your account deletion has been scheduled for 30 days from now. You can cancel this at any time before then.");
      setShowDeleteModal(false);
      loadUserData();
    } catch (error) {
      console.error("Error scheduling deletion:", error);
      alert("Error scheduling account deletion. Please try again.");
    }
  };

  const handleCancelDeletion = async () => {
    try {
      await User.updateMyUserData({
        account_status: 'active',
        deletion_scheduled_date: null
      });

      alert("Account deletion has been cancelled.");
      loadUserData();
    } catch (error) {
      console.error("Error cancelling deletion:", error);
      alert("Error cancelling account deletion. Please try again.");
    }
  };

  const handleReactivateAccount = async () => {
    try {
      await User.updateMyUserData({
        account_status: 'active',
        deactivated_date: null
      });

      alert("Your account has been reactivated!");
      loadUserData();
    } catch (error) {
      console.error("Error reactivating account:", error);
      alert("Error reactivating account. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="creator-card h-96 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="creator-card p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Customize your profile and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Settings */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <UserIcon className="w-5 h-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="Choose a unique username"
                    className="pr-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {usernameStatus.checking ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : usernameStatus.available === true ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : usernameStatus.available === false ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                </div>
                {usernameStatus.message && (
                  <p className={`text-sm ${
                    usernameStatus.available === true ? 'text-green-600 dark:text-green-400' : 
                    usernameStatus.available === false ? 'text-red-600 dark:text-red-400' : 
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {usernameStatus.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose a unique username that others will see. Must be at least 3 characters.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-gray-700 dark:text-gray-300">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
                  placeholder="Your full name"
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-700 dark:text-gray-300">Professional Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g., Frontend Developer, UX Designer"
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-gray-700 dark:text-gray-300">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell others about yourself..."
                  rows={4}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* User Type */}
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Primary Role</Label>
                <Select value={formData.user_type} onValueChange={(value) => handleInputChange("user_type", value)}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="creator" className="dark:text-gray-100">Creator</SelectItem>
                    <SelectItem value="developer" className="dark:text-gray-100">Developer</SelectItem>
                    <SelectItem value="freelancer" className="dark:text-gray-100">Freelancer</SelectItem>
                    <SelectItem value="explorer" className="dark:text-gray-100">Explorer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Skills</Label>
                <div className="flex gap-2">
                  <Input
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    placeholder="Add a skill"
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <Button type="button" onClick={addSkill} variant="outline" className="dark:border-gray-600 dark:text-gray-300">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {skill}
                      <button 
                        type="button" 
                        onClick={() => removeSkill(skill)} 
                        className="ml-1.5 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Palette className="w-5 h-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Theme Mode</Label>
                <Select value={formData.theme_mode} onValueChange={(value) => handleInputChange("theme_mode", value)}>
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="light" className="dark:text-gray-100">Light</SelectItem>
                    <SelectItem value="dark" className="dark:text-gray-100">Dark</SelectItem>
                    <SelectItem value="system" className="dark:text-gray-100">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-gray-700 dark:text-gray-300">Use Role Colors</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Apply role-based color themes to the interface</p>
                </div>
                <Switch
                  checked={formData.use_role_colors}
                  onCheckedChange={(checked) => handleInputChange("use_role_colors", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Shield className="w-5 h-5" />
                Privacy & Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Profile Visibility</Label>
                <Select 
                  value={formData.privacy_settings.profile_visibility} 
                  onValueChange={(value) => handleInputChange("privacy_settings.profile_visibility", value)}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="public" className="dark:text-gray-100">Public</SelectItem>
                    <SelectItem value="members_only" className="dark:text-gray-100">Members Only</SelectItem>
                    <SelectItem value="private" className="dark:text-gray-100">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Default Post Privacy */}
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Default Post Privacy</Label>
                <Select 
                  value={formData.default_post_privacy} 
                  onValueChange={(value) => handleInputChange("default_post_privacy", value)}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectItem value="public" className="dark:text-gray-100">Public</SelectItem>
                    <SelectItem value="private" className="dark:text-gray-100">Private</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose the default visibility for new posts you create. You can always change it per-post.
                </p>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-700" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-gray-700 dark:text-gray-300">Show Email</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Display your email on your public profile</p>
                  </div>
                  <Switch
                    checked={formData.privacy_settings.show_email}
                    onCheckedChange={(checked) => handleInputChange("privacy_settings.show_email", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-gray-700 dark:text-gray-300">Allow Direct Messages</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Let other users send you direct messages</p>
                  </div>
                  <Switch
                    checked={formData.privacy_settings.allow_direct_messages}
                    onCheckedChange={(checked) => handleInputChange("privacy_settings.allow_direct_messages", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-gray-700 dark:text-gray-300">Show Activity</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Display your recent activity on your profile</p>
                  </div>
                  <Switch
                    checked={formData.privacy_settings.show_activity}
                    onCheckedChange={(checked) => handleInputChange("privacy_settings.show_activity", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tutorial Settings */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Lightbulb className="w-5 h-5" />
                Tutorial & Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-gray-700 dark:text-gray-300">Tutorial Progress</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.tutorial_completed ? "Tutorial completed" : "Tutorial in progress"}
                  </p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={restartTutorial}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Restart Tutorial
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Management */}
          <Card className="creator-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Shield className="w-5 h-5" />
                Account Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.account_status === 'active' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-gray-700 dark:text-gray-300">Deactivate Account</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Temporarily hide your profile and make all posts private
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeactivateModal(true)}
                      className="border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/50"
                    >
                      Deactivate
                    </Button>
                  </div>

                  <Separator className="bg-gray-200 dark:bg-gray-700" />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-gray-700 dark:text-gray-300">Delete Account</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Permanently delete your account and all data (30 day grace period)
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteModal(true)}
                      className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              )}

              {user?.account_status === 'deactivated' && user.deactivated_date && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-orange-800 dark:text-orange-200">Account Deactivated</Label>
                      <p className="text-sm text-orange-600 dark:text-orange-300">
                        Your account was deactivated on {format(new Date(user.deactivated_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button 
                      onClick={handleReactivateAccount}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      Reactivate
                    </Button>
                  </div>
                </div>
              )}

              {user?.account_status === 'pending_deletion' && user.deletion_scheduled_date && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-red-800 dark:text-red-200">Account Deletion Scheduled</Label>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        Your account will be permanently deleted on {format(new Date(user.deletion_scheduled_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Button 
                      onClick={handleCancelDeletion}
                      variant="outline"
                      className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                    >
                      Cancel Deletion
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving || (formData.username && formData.username !== user?.username && !usernameStatus.available)}
              className="creator-btn"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Deactivate Modal */}
        {showDeactivateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="creator-card p-6 max-w-md w-full mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deactivate Account</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to deactivate your account? This will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1">
                <li>Hide your profile from other users</li>
                <li>Make all your posts private</li>
                <li>Remove you from search results</li>
                <li>You can reactivate anytime</li>
              </ul>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 dark:border-gray-600 dark:text-gray-300"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeactivateAccount}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Deactivate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="creator-card p-6 max-w-md w-full mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Account</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to permanently delete your account? This will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1">
                <li>Schedule deletion in 30 days</li>
                <li>Permanently remove all your posts</li>
                <li>Delete all your comments and interactions</li>
                <li>Remove your profile completely</li>
                <li><strong>This cannot be undone after 30 days</strong></li>
              </ul>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 dark:border-gray-600 dark:text-gray-300"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleScheduleDeletion}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Schedule Deletion
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
