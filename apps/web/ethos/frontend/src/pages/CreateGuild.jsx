import React, { useState, useEffect } from 'react';
import { Guild, User, GuildMembership } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Lock, Globe, Loader2, Info } from 'lucide-react';

export default function CreateGuild() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [guildData, setGuildData] = useState({
    name: '',
    description: '',
    guild_type: 'custom',
    is_public: true,
    passcode: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    User.me().then(setCurrentUser).catch(() => navigate(createPageUrl('Dashboard')));
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setGuildData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('You must be logged in to create a guild.');
      return;
    }
    if (!guildData.is_public && !guildData.passcode) {
      alert('Private guilds require a passcode.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const newGuildData = { ...guildData };
      if (newGuildData.is_public) {
        newGuildData.passcode = ''; // Clear passcode for public guilds
      }
      
      const newGuild = await Guild.create({ ...newGuildData, created_by: currentUser.email, member_count: 1 });
      
      await GuildMembership.create({
        guild_id: newGuild.id,
        user_email: currentUser.email,
        role: 'owner',
        joined_date: new Date().toISOString()
      });
      
      alert('Guild created successfully!');
      navigate(createPageUrl('GuildDetail') + `?id=${newGuild.id}`);
      
    } catch (error) {
      console.error('Error creating guild:', error);
      alert('Failed to create guild. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Community
        </Button>
        <Card className="creator-card">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Create a New Guild</CardTitle>
            <CardDescription>Build your own community of creators, developers, or friends.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Guild Name</Label>
                <Input id="name" value={guildData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="e.g., The Artisan's Collective" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={guildData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="What is your guild about?" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guild_type">Guild Type</Label>
                <Select value={guildData.guild_type} onValueChange={(value) => handleInputChange('guild_type', value)}>
                  <SelectTrigger id="guild_type">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                    <SelectItem value="explorer">Explorer</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Card className="p-4 bg-gray-50 dark:bg-gray-800 border">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="is_public" className="font-semibold">Guild Privacy</Label>
                    <CardDescription>
                      {guildData.is_public ? 'Anyone can find and join this guild.' : 'Only people with the passcode can join.'}
                    </CardDescription>
                  </div>
                  <Switch id="is_public" checked={guildData.is_public} onCheckedChange={(checked) => handleInputChange('is_public', checked)} />
                </div>
                {!guildData.is_public && (
                  <div className="mt-4">
                    <Label htmlFor="passcode">Private Guild Passcode</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input id="passcode" value={guildData.passcode} onChange={(e) => handleInputChange('passcode', e.target.value)} placeholder="Enter a secret passcode" required className="pl-10" />
                    </div>
                  </div>
                )}
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="creator-btn">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Creating Guild...' : 'Create Guild'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}