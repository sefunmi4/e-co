import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Guild } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wrench, Loader2 } from 'lucide-react';

export default function AdminUtils() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState('');

    const handleResetMemberCounts = async () => {
        if (!window.confirm("Are you sure you want to reset all guild member counts to 0? This should only be done after clearing the GuildMembership data table.")) {
            return;
        }

        setIsProcessing(true);
        setResult('');
        try {
            const allGuilds = await Guild.list();
            if (allGuilds.length > 0) {
                const updates = allGuilds.map(guild => Guild.update(guild.id, { member_count: 0 }));
                await Promise.all(updates);
                setResult(`Successfully reset member counts for ${allGuilds.length} guilds.`);
            } else {
                setResult("No guilds found to update.");
            }
        } catch (error) {
            console.error("Error resetting member counts:", error);
            setResult(`An error occurred: ${error.message}`);
        }
        setIsProcessing(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-2xl mx-auto">
                <Card className="creator-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Wrench className="w-6 h-6" /> Admin Utilities
                        </CardTitle>
                        <CardDescription>
                            Use these tools for administrative tasks. Proceed with caution.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-lg">Reset Guild Member Counts</CardTitle>
                                <CardDescription>
                                    This will set the 'member_count' field to 0 for all guilds. Use this after manually deleting all records from the GuildMembership table to fix inconsistencies.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleResetMemberCounts} disabled={isProcessing} className="creator-btn">
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isProcessing ? "Processing..." : "Reset Member Counts"}
                                </Button>
                                {result && (
                                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                                        {result}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}