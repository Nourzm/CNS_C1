import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ModuleDetail from "./pages/ModuleDetail";
import GroupDetail from "./pages/GroupDetail";
import SessionDetail from "./pages/SessionDetail";
import SpoofLog from "./pages/SpoofLog";
import ActivityLog from "./pages/ActivityLog";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";
import RegisterStudent from "./pages/RegisterStudent";
import Attendance from "./pages/Attendance";
import AddModule from "./pages/AddModule";
import StudentsList from "./pages/StudentsList";
import TeachersList from "./pages/TeachersList";
import ModulesList from "./pages/ModulesList";
import Assignments from "./pages/Assignments";
import Timetable from "./pages/Timetable";
import StudentProfile from "./pages/StudentProfile";
import AttendanceHistory from "./pages/AttendanceHistory";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

const ProtectedRoute = () => {
  const { session, loading, isTeacher, signOut } = useAuth();

  if (loading || (session && isTeacher === null)) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  // Logged in via Supabase Auth but NOT in the teachers table
  if (isTeacher === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4 border border-border rounded-2xl p-8 bg-card">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            Your account is not registered as a teacher in the system.
            Please contact the administration to get access.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full mt-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }
  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/modules" element={<ModulesList />} />
                <Route path="/modules/add" element={<AddModule />} />
                <Route path="/modules/:id" element={<ModuleDetail />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/sessions/:id" element={<SessionDetail />} />
                <Route path="/students" element={<StudentsList />} />
                <Route path="/teachers" element={<TeachersList />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/assignments" element={<Assignments />} />
                <Route
                  path="/students/register"
                  element={<RegisterStudent />}
                />
                <Route path="/students/:id" element={<StudentProfile />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/history" element={<AttendanceHistory />} />
                <Route path="/security" element={<Security />} />
                <Route path="/security/spoof-log" element={<SpoofLog />} />
                <Route path="/admin/activity" element={<ActivityLog />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
