"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@clerk/nextjs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Trophy, BookOpen, Target, Flame, TrendingUp, Clock } from "lucide-react";

interface ProgressData {
  stats: {
    lessons: number;
    quizzes: number;
    avg_score: number;
    difficulty_level: string;
    cards_reviewed?: number;
  };
  history: {
    item_type: string;
    title: string;
    score?: number;
    completed_at: string;
  }[];
}

interface AnalyticsWidgetsProps {
  className?: string;
}

// Color palette for charts
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444"];

export function AnalyticsWidgets({ className }: AnalyticsWidgetsProps) {
  const { user } = useUser();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [quizScores, setQuizScores] = useState<any[]>([]);
  const [topicDistribution, setTopicDistribution] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchProgressData();
    }
  }, [user?.id]);

  const fetchProgressData = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/v1/agents/progress?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const payload = data.payload || data;
        setProgressData(payload);
        processAnalyticsData(payload);
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (data: ProgressData) => {
    const history = data.history || [];

    // Process weekly lessons data
    const weeklyMap = new Map<string, number>();
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      weeklyMap.set(dayName, 0);
    }

    history.forEach((item) => {
      if (item.item_type === "lesson" && item.completed_at) {
        const itemDate = new Date(item.completed_at);
        const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 6) {
          const dayName = itemDate.toLocaleDateString("en-US", { weekday: "short" });
          weeklyMap.set(dayName, (weeklyMap.get(dayName) || 0) + 1);
        }
      }
    });

    setWeeklyData(
      Array.from(weeklyMap.entries()).map(([day, count]) => ({
        day,
        lessons: count,
      }))
    );

    // Process quiz scores over time
    const quizHistory = history
      .filter((item) => item.item_type === "quiz" && item.score !== undefined)
      .slice(-10)
      .map((item, index) => ({
        quiz: `Quiz ${index + 1}`,
        score: item.score,
        title: item.title?.slice(0, 20) || `Quiz ${index + 1}`,
      }));
    setQuizScores(quizHistory);

    // Process topic distribution (simulated based on history)
    const topicMap = new Map<string, number>();
    history.forEach((item) => {
      const topic = extractTopic(item.title || "");
      if (topic) {
        topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
      }
    });

    const topicArray = Array.from(topicMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    setTopicDistribution(topicArray.length > 0 ? topicArray : [{ name: "Start Learning", value: 1 }]);

    // Calculate streak (consecutive days with activity)
    calculateStreak(history);
  };

  const extractTopic = (title: string): string => {
    // Extract main topic keyword from title
    const keywords = ["Python", "JavaScript", "React", "HTML", "CSS", "SQL", "Data", "Algorithm", "Machine Learning"];
    for (const kw of keywords) {
      if (title.toLowerCase().includes(kw.toLowerCase())) {
        return kw;
      }
    }
    // Return first word if no keyword found
    return title.split(" ")[0] || "General";
  };

  const calculateStreak = (history: ProgressData["history"]) => {
    if (history.length === 0) {
      setStreak(0);
      return;
    }

    const uniqueDays = new Set<string>();
    history.forEach((item) => {
      if (item.completed_at) {
        uniqueDays.add(new Date(item.completed_at).toDateString());
      }
    });

    let currentStreak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (uniqueDays.has(checkDate.toDateString())) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    setStreak(currentStreak);
  };

  if (loading) {
    return (
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-20 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = progressData?.stats || {
    lessons: 0,
    quizzes: 0,
    avg_score: 0,
    difficulty_level: "Beginner",
  };

  return (
    <div className={className}>
      {/* Summary Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 hover:border-blue-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lessons Completed</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold tracking-tight">{stats.lessons}</div>
            <p className="text-xs text-muted-foreground mt-1">Keep learning!</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-card to-card border-purple-500/20 hover:border-purple-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/20 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quizzes Taken</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold tracking-tight">{stats.quizzes}</div>
            <p className="text-xs text-muted-foreground mt-1">Avg: {stats.avg_score.toFixed(0)}%</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 hover:border-emerald-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/20 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Level</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Trophy className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold tracking-tight">{stats.difficulty_level}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on performance</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-card to-card border-orange-500/20 hover:border-orange-500/40 transition-all group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/20 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold tracking-tight flex items-center gap-2">
              {streak}
              <span className="text-lg font-normal text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {streak > 0 ? "🔥 Keep it up!" : "Start your streak today!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Weekly Lessons Bar Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Lessons This Week
            </CardTitle>
            <CardDescription>Daily lessons completed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {weeklyData.some(d => d.lessons > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="lessons" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <BookOpen className="h-8 w-8 opacity-40" />
                  <span>Complete lessons to see your activity</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quiz Scores Line Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Quiz Performance
            </CardTitle>
            <CardDescription>Score trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {quizScores.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={quizScores}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="quiz" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Take quizzes to see your performance
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Topic Distribution Pie Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time by Topic
            </CardTitle>
            <CardDescription>Learning distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              {topicDistribution.length > 0 && topicDistribution[0].name !== "Start Learning" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topicDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name }) => name}
                    >
                      {topicDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Clock className="h-8 w-8 opacity-40" />
                  <span>Learn topics to see distribution</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
