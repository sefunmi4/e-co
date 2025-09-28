import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User } from "@/api/entities";
import { Github } from "lucide-react";

export default function GitHubConnectModal({ onClose, onSuccess }) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!username.trim()) {
      setError('Please enter a GitHub username.');
      return;
    }
    
    // Basic username validation
    const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    if (!usernameRegex.test(username)) {
      setError('Please enter a valid GitHub username (letters, numbers, and hyphens only).');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Update the user data in base44 without API verification
      // We'll construct the avatar URL based on GitHub's standard format
      const avatarUrl = `https://github.com/${username}.png`;
      
      await User.updateMyUserData({ 
        github_username: username.trim(),
        github_avatar_url: avatarUrl
      });
      
      onSuccess();
    } catch (e) {
      setError('Failed to save GitHub username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Github className="w-6 h-6" />
            Connect your GitHub Account
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Enter your GitHub username to link your account. This will display your avatar and link your profile on Ethos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="github-username" className="text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Username</label>
            <Input
              id="github-username"
              placeholder="e.g., torvalds"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Make sure to enter your exact GitHub username for the avatar to display correctly.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button 
            onClick={handleConnect} 
            disabled={isLoading}
            className="w-full creator-btn"
          >
            {isLoading ? 'Connecting...' : 'Connect GitHub Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}