import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github, GitBranch } from "lucide-react";

export default function ConvertToProjectModal({ quest, onClose, onSubmit }) {
  const [githubUrl, setGithubUrl] = useState('');

  const handleSubmit = () => {
    if (!githubUrl.trim()) return;
    onSubmit({ github_url: githubUrl });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-6 h-6" />
            Convert to Project
          </DialogTitle>
          <DialogDescription>
            Convert "{quest.title}" into a project by linking a GitHub repository. This allows for better tracking and collaboration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="github-url" className="text-sm font-medium flex items-center gap-2">
              <Github className="w-4 h-4" />
              GitHub Repository URL
            </label>
            <Input
              id="github-url"
              placeholder="https://github.com/username/repository"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
             <p className="text-xs text-gray-500">
              Paste the full URL of the GitHub repository for this project.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!githubUrl.trim()} className="creator-btn">
              Convert to Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}