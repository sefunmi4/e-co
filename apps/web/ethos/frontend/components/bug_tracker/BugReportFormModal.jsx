import React, { useState, useRef } from 'react';
import { BugReport } from '@/api/entities';
import { UploadFile } from "@/api/integrations";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, X, File as FileIcon } from 'lucide-react';

export default function BugReportFormModal({ isOpen, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('bug');
  const [pageUrl, setPageUrl] = useState(window.location.href);
  const [screenshots, setScreenshots] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setIsUploading(true);
    try {
        const uploadPromises = files.map(file => UploadFile({ file }));
        const results = await Promise.all(uploadPromises);
        const urls = results.map(res => res.file_url);
        setScreenshots(prev => [...prev, ...urls]);
    } catch (err) {
        console.error("Error uploading screenshots:", err);
        alert("There was an error uploading your files. Please try again.");
    }
    setIsUploading(false);
  };
  
  const removeScreenshot = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description) {
      alert("Please fill out the title and description.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await BugReport.create({
        title,
        description,
        report_type: reportType,
        page_url: pageUrl,
        screenshot_urls: screenshots
      });
      alert('Report submitted successfully! Thank you for your feedback.');
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setReportType('bug');
      setScreenshots([]);
      setPageUrl(window.location.href);
    } catch (error) {
      console.error('Failed to submit report:', error);
      alert('There was an error submitting your report. Please try again.');
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Report an Issue or Suggestion</DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            Your feedback helps us improve QuestFlow. Thank you for your contribution!
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type" className="dark:text-gray-300">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="type" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                <SelectItem value="bug" className="dark:text-gray-300 dark:focus:bg-gray-700">Bug Report</SelectItem>
                <SelectItem value="feature_request" className="dark:text-gray-300 dark:focus:bg-gray-700">Feature Request</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title" className="dark:text-gray-300">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 'Cannot upload file on Create Quest page'" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description" className="dark:text-gray-300">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Please provide as much detail as possible, including steps to reproduce." className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
          </div>
           <div className="grid gap-2">
            <Label htmlFor="pageUrl" className="dark:text-gray-300">Page URL</Label>
            <Input id="pageUrl" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} placeholder="The URL where you encountered the issue" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
          </div>
          <div className="grid gap-2">
            <Label className="dark:text-gray-300">Screenshots (optional)</Label>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600 dark:text-gray-300">
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/png, image/jpeg, image/gif"
            />
             <div className="flex flex-wrap gap-2 mt-2">
                {screenshots.map((url, index) => (
                  <div key={index} className="relative group">
                    <img src={url} alt={`screenshot ${index + 1}`} className="h-20 w-20 object-cover rounded-md border" />
                    <button onClick={() => removeScreenshot(index)} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="dark:text-gray-300 dark:hover:bg-gray-700">Cancel</Button>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="creator-btn">
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}