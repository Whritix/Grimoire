"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Download } from "lucide-react"

export default function SettingsPage() {
    const [notifications, setNotifications] = useState({
        email: true,
        push: false,
        weekly: true,
    })

    return (
        <div className="min-h-screen bg-background">

            <main className="container mx-auto px-4 py-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                >
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                            <SettingsIcon className="h-8 w-8 text-primary" />
                            Settings
                        </h1>
                        <p className="text-muted-foreground">Manage your account preferences and settings</p>
                    </div>

                    {/* Profile Settings */}
                    <Card className="p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Profile Settings
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" defaultValue="Alex Johnson" className="mt-2" />
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" defaultValue="alex.johnson@example.com" className="mt-2" />
                            </div>
                            <div>
                                <Label htmlFor="goal">Learning Goal</Label>
                                <Input id="goal" defaultValue="Full Stack Developer" className="mt-2" />
                            </div>
                            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Save Changes</Button>
                        </div>
                    </Card>

                    {/* Notification Settings */}
                    <Card className="p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Bell className="h-5 w-5" />
                            Notifications
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Email Notifications</p>
                                    <p className="text-sm text-muted-foreground">Receive updates via email</p>
                                </div>
                                <Switch
                                    checked={notifications.email}
                                    onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Push Notifications</p>
                                    <p className="text-sm text-muted-foreground">Browser push notifications</p>
                                </div>
                                <Switch
                                    checked={notifications.push}
                                    onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                                />
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Weekly Summary</p>
                                    <p className="text-sm text-muted-foreground">Get weekly progress reports</p>
                                </div>
                                <Switch
                                    checked={notifications.weekly}
                                    onCheckedChange={(checked) => setNotifications({ ...notifications, weekly: checked })}
                                />
                            </div>
                        </div>
                    </Card>

                    {/* Appearance */}
                    <Card className="p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Palette className="h-5 w-5" />
                            Appearance
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <Label>Theme</Label>
                                <div className="flex gap-3 mt-2">
                                    <Button variant="outline" className="flex-1">Light</Button>
                                    <Button variant="outline" className="flex-1">Dark</Button>
                                    <Button variant="outline" className="flex-1">System</Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Privacy & Data */}
                    <Card className="p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Privacy & Data
                        </h2>
                        <div className="space-y-3">
                            <Button variant="outline" className="w-full justify-start">
                                <Download className="mr-2 h-4 w-4" />
                                Export Your Data
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-red-500 hover:text-red-600">
                                Delete Account
                            </Button>
                        </div>
                    </Card>
                </motion.div>
            </main>
        </div>
    )
}
