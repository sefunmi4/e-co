import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, AlertTriangle } from "lucide-react";

export default function TermsOfServiceModal({ isOpen, onAccept, onDecline }) {
  const [hasRead, setHasRead] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const handleAccept = () => {
    if (hasRead && ageConfirmed) {
      onAccept();
    }
  };

  const canAccept = hasRead && ageConfirmed;

  return (
    <Dialog open={isOpen} onOpenChange={onDecline}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Shield className="w-6 h-6 text-blue-600" />
            Terms of Service & Age Verification
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-96 w-full pr-4">
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">Age Requirement</h3>
                  <p className="text-red-700 dark:text-red-400">
                    This platform is intended for users who are 18 years of age or older. By using this service, 
                    you confirm that you meet this age requirement.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="font-semibold text-gray-900 dark:text-white">1. Acceptance of Terms</h3>
            <p>
              By accessing and using Ethos ("the Platform"), you accept and agree to be bound by the terms and 
              provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">2. Age Verification</h3>
            <p>
              You must be at least 18 years old to use this Platform. By using this service, you represent and 
              warrant that you are at least 18 years of age and have the legal capacity to enter into this agreement.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">3. User Content</h3>
            <p>
              Users are responsible for all content they post, including projects, comments, and profile information. 
              You retain ownership of your content but grant us a license to display and distribute it on the Platform.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">4. Prohibited Conduct</h3>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Post content that is illegal, harmful, or violates others' rights</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Impersonate others or provide false information</li>
              <li>Spam or engage in unauthorized commercial activities</li>
              <li>Attempt to gain unauthorized access to the Platform</li>
            </ul>

            <h3 className="font-semibold text-gray-900 dark:text-white">5. Privacy</h3>
            <p>
              We respect your privacy and handle your personal information according to our Privacy Policy. 
              By using the Platform, you consent to our collection and use of your information as described.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">6. Intellectual Property</h3>
            <p>
              The Platform and its original content, features, and functionality are owned by Ethos and are 
              protected by international copyright, trademark, and other intellectual property laws.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">7. Disclaimers</h3>
            <p>
              The Platform is provided "as is" without warranties of any kind. We do not guarantee the accuracy, 
              completeness, or usefulness of any information on the Platform.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">8. Limitation of Liability</h3>
            <p>
              In no event shall Ethos be liable for any indirect, incidental, special, consequential, or punitive 
              damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">9. Termination</h3>
            <p>
              We may terminate or suspend your account and access to the Platform immediately, without prior notice, 
              for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">10. Changes to Terms</h3>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any material changes. 
              Your continued use of the Platform after changes constitutes acceptance of the new terms.
            </p>

            <h3 className="font-semibold text-gray-900 dark:text-white">11. Contact Information</h3>
            <p>
              If you have any questions about these Terms, please contact us through the Platform's feedback system.
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </ScrollArea>

        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start space-x-2">
            <Checkbox 
              id="age-confirm" 
              checked={ageConfirmed}
              onCheckedChange={setAgeConfirmed}
            />
            <label htmlFor="age-confirm" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              I confirm that I am 18 years of age or older
            </label>
          </div>
          
          <div className="flex items-start space-x-2">
            <Checkbox 
              id="terms-read" 
              checked={hasRead}
              onCheckedChange={setHasRead}
            />
            <label htmlFor="terms-read" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              I have read and agree to the Terms of Service
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDecline} className="dark:border-gray-600 dark:text-gray-300">
            Decline
          </Button>
          <Button 
            onClick={handleAccept}
            disabled={!canAccept}
            className="creator-btn"
          >
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}