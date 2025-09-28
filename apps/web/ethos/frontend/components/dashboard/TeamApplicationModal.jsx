
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, UserSearch } from "lucide-react";

const roleTypeColors = {
  creator: "bg-purple-100 text-purple-700 border-purple-200",
  developer: "bg-blue-100 text-blue-700 border-blue-200",
  freelancer: "bg-green-100 text-green-700 border-green-200",
  explorer: "bg-orange-100 text-orange-700 border-orange-200"
};

export default function TeamApplicationModal({ quest, availableRoles, onClose, onSubmit }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");
  const [portfolioLinks, setPortfolioLinks] = useState([]);
  const [newPortfolioLink, setNewPortfolioLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddPortfolioLink = () => {
    if (newPortfolioLink.trim() && !portfolioLinks.includes(newPortfolioLink.trim())) {
      setPortfolioLinks(prev => [...prev, newPortfolioLink.trim()]);
      setNewPortfolioLink("");
    }
  };

  const handleRemovePortfolioLink = (linkToRemove) => {
    setPortfolioLinks(prev => prev.filter(link => link !== linkToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole || !applicationMessage.trim()) {
      alert("Please select a role and provide an application message.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({
        role_type: selectedRole,
        application_message: applicationMessage.trim(),
        portfolio_links: portfolioLinks
      });
      onClose();
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Error submitting application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedRole && applicationMessage.trim().length > 0 && !isSubmitting;
  const hasAvailableRoles = availableRoles && availableRoles.length > 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Join Team</DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Apply to join "{quest.title}"
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            {hasAvailableRoles ? (
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Select a Role <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {availableRoles.map((role, idx) => (
                        <label key={idx} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedRole === role.role_type ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-600'}`}>
                          <input
                            type="radio"
                            name="role"
                            value={role.role_type}
                            checked={selectedRole === role.role_type}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="form-radio h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2">
                            <Badge className={`${roleTypeColors[role.role_type]} border text-sm`}>
                              {role.count} {role.role_type}{role.count > 1 ? 's' : ''}
                            </Badge>
                            {role.description && (
                              <span className="text-sm text-gray-600 dark:text-gray-400">- {role.description}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        I am applying as... <span className="text-red-500">*</span>
                    </label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="creator">Creator</SelectItem>
                            <SelectItem value="freelancer">Freelancer</SelectItem>
                            <SelectItem value="explorer">Explorer</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">The creator did not specify roles, please select one that fits you.</p>
                </div>
            )}
           
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Why do you want to join this team? <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={applicationMessage}
                onChange={(e) => setApplicationMessage(e.target.value)}
                placeholder="Explain your interest and what you can contribute..."
                rows={4}
                className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Portfolio Links (Optional)
              </label>
              <div className="flex gap-2">
                <Input
                  value={newPortfolioLink}
                  onChange={(e) => setNewPortfolioLink(e.target.value)}
                  placeholder="https://..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddPortfolioLink())}
                  className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
                <Button type="button" onClick={handleAddPortfolioLink} variant="outline" size="sm" className="dark:border-gray-600 dark:text-gray-300">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {portfolioLinks.length > 0 && (
                <div className="space-y-1 pt-2">
                  {portfolioLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
                      >
                        {link}
                      </a>
                      <Button
                        type="button"
                        onClick={() => handleRemovePortfolioLink(link)}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 h-6 w-6"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="dark:border-gray-600 dark:text-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="transition-all"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
