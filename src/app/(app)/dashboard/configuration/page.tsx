import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function ConfigurationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuration Panel</h2>
        <p className="text-muted-foreground">
          Manage your Evolution API settings, business hours, auto-responders, and welcome messages.
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>API Settings</CardTitle>
          <CardDescription>Configure your connection to the Evolution API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">API URL</Label>
            <Input id="apiUrl" placeholder="https://api.example.com/evolution" defaultValue="https://your-evolution-api-url.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input id="apiKey" type="password" placeholder="Enter your API Key" defaultValue="yourSecretApiKey" />
          </div>
          <Button>Test Connection</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
          <CardDescription>Set your operational hours for automated responses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="businessHoursEnabled" defaultChecked />
            <Label htmlFor="businessHoursEnabled">Enable Business Hours</Label>
          </div>
          {/* Add more complex business hours configuration here: day pickers, time inputs etc. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="time" defaultValue="09:00" />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="time" defaultValue="17:00" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="outOfOfficeMessage">Out of Office Message</Label>
            <Textarea id="outOfOfficeMessage" placeholder="We are currently unavailable..." defaultValue="Thank you for your message. We are currently out of office and will get back to you during our business hours (Mon-Fri, 9 AM - 5 PM)." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto Responders & Welcome Messages</CardTitle>
          <CardDescription>Customize automated messages for your users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch id="welcomeMessageEnabled" defaultChecked />
            <Label htmlFor="welcomeMessageEnabled">Enable Welcome Message</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message Text</Label>
            <Textarea id="welcomeMessage" placeholder="Welcome to our service!" defaultValue="Hello! Welcome to [Your Company Name]. How can we help you today?"/>
          </div>
          
          <Separator className="my-6" />

          <div className="flex items-center space-x-2">
            <Switch id="autoResponderEnabled" />
            <Label htmlFor="autoResponderEnabled">Enable General Auto-Responder (e.g., for common keywords)</Label>
          </div>
           <div className="space-y-2">
            <Label htmlFor="autoResponderKeywords">Keywords (comma-separated)</Label>
            <Input id="autoResponderKeywords" placeholder="pricing, help, support" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="autoResponderMessage">Auto-Response Message</Label>
            <Textarea id="autoResponderMessage" placeholder="Thanks for asking about..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg">Save Configurations</Button>
      </div>
    </div>
  );
}
