import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Home, Menu, X, ChevronUp, ChevronDown } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useAppContext } from "@/lib/appContext";
import { t } from "@/lib/translations";

interface FloatingNavBarProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  isOnChatPage?: boolean;
}

export function FloatingNavBar({ isSidebarOpen = false, onToggleSidebar, isOnChatPage = false }: FloatingNavBarProps) {
  const { language } = useAppContext();
  const [location, navigate] = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleNavigate = (route: string) => {
    console.log("[FloatingNavBar] Navigating to:", route);
    navigate(route);
    if (isMobile) setIsExpanded(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isMobile) {
    return (
      <div 
        className="fixed flex flex-col gap-2 transition-all duration-300"
        style={{
          bottom: "20px",
          left: "16px",
          zIndex: 99999,
          pointerEvents: "auto"
        }}
      >
        {isExpanded && (
          <>
            <div 
              className="flex flex-col gap-2 animate-fade-in-up"
              style={{
                animation: "slideUp 0.25s ease-out forwards"
              }}
            >
              <button
                type="button"
                onClick={() => handleNavigate("/")}
                className="p-3 rounded-full backdrop-blur-lg cursor-pointer"
                style={{
                  backgroundColor: location === "/" ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)",
                  border: location === "/" ? "2px solid rgba(0, 240, 255, 1)" : "1px solid rgba(0, 240, 255, 0.4)",
                  boxShadow: location === "/" ? "0 0 12px rgba(0, 240, 255, 0.6)" : "0 0 8px rgba(0, 240, 255, 0.2)",
                  pointerEvents: "auto"
                }}
                title={t("nav.home", language)}
                data-testid="button-floating-nav-home"
              >
                <Home className="w-5 h-5 text-cyan-400" />
              </button>

              <a
                href="https://wa.me/qr/P6WIWVS7UAU5P1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-full backdrop-blur-lg cursor-pointer inline-flex items-center justify-center"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  border: "1px solid rgba(31, 193, 120, 0.4)",
                  boxShadow: "0 0 8px rgba(31, 193, 120, 0.2)",
                  pointerEvents: "auto"
                }}
                title="Contact via WhatsApp"
                data-testid="button-floating-nav-whatsapp"
              >
                <SiWhatsapp className="w-5 h-5" style={{ color: "#1fC158" }} />
              </a>

              {isOnChatPage && onToggleSidebar && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSidebar();
                    setIsExpanded(false);
                  }}
                  className="p-3 rounded-full backdrop-blur-lg cursor-pointer"
                  style={{
                    backgroundColor: isSidebarOpen ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)",
                    border: isSidebarOpen ? "2px solid rgba(255, 0, 110, 1)" : "1px solid rgba(255, 0, 110, 0.4)",
                    boxShadow: isSidebarOpen ? "0 0 12px rgba(255, 0, 110, 0.6)" : "0 0 8px rgba(255, 0, 110, 0.2)",
                    pointerEvents: "auto"
                  }}
                  title={isSidebarOpen ? "إخفاء القائمة" : "عرض القائمة"}
                  data-testid="button-floating-nav-sidebar-toggle"
                >
                  {isSidebarOpen ? (
                    <X className="w-5 h-5" style={{ color: "#FF006E" }} />
                  ) : (
                    <Menu className="w-5 h-5" style={{ color: "#FF006E" }} />
                  )}
                </button>
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={toggleExpand}
          className="p-3 rounded-full backdrop-blur-lg cursor-pointer"
          style={{
            backgroundColor: isExpanded ? "rgba(0, 0, 0, 0.9)" : "rgba(0, 0, 0, 0.7)",
            border: isExpanded ? "2px solid rgba(180, 100, 255, 1)" : "2px solid rgba(180, 100, 255, 0.6)",
            boxShadow: isExpanded ? "0 0 15px rgba(180, 100, 255, 0.7)" : "0 0 10px rgba(180, 100, 255, 0.4)",
            pointerEvents: "auto",
            transition: "all 0.2s ease"
          }}
          title={isExpanded ? "إغلاق القائمة" : "فتح القائمة"}
          data-testid="button-floating-nav-toggle"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" style={{ color: "#B466FF" }} />
          ) : (
            <ChevronUp className="w-5 h-5" style={{ color: "#B466FF" }} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed flex gap-2 transition-all duration-300"
      style={{
        top: "15%",
        left: "20px",
        flexDirection: "column",
        zIndex: 99999,
        pointerEvents: "auto"
      }}
    >
      <button
        type="button"
        onClick={() => handleNavigate("/")}
        className="p-3 rounded-full transition-all duration-200 backdrop-blur-lg hover:scale-110 active:scale-95 cursor-pointer"
        style={{
          backgroundColor: location === "/" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)",
          border: location === "/" ? "2px solid rgba(0, 240, 255, 1)" : "1px solid rgba(0, 240, 255, 0.3)",
          boxShadow: location === "/" ? "0 0 15px rgba(0, 240, 255, 0.8)" : "0 0 10px rgba(0, 240, 255, 0.2)",
          pointerEvents: "auto"
        }}
        title={t("nav.home", language)}
        data-testid="button-floating-nav-home"
      >
        <Home className="w-6 h-6 text-cyan-400" />
      </button>

      <a
        href="https://wa.me/qr/P6WIWVS7UAU5P1"
        target="_blank"
        rel="noopener noreferrer"
        className="p-3 rounded-full transition-all duration-200 backdrop-blur-lg hover:scale-110 active:scale-95 cursor-pointer inline-flex items-center justify-center"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          border: "1px solid rgba(31, 193, 120, 0.3)",
          boxShadow: "0 0 10px rgba(31, 193, 120, 0.2)",
          pointerEvents: "auto"
        }}
        title="Contact via WhatsApp"
        data-testid="button-floating-nav-whatsapp"
      >
        <SiWhatsapp className="w-6 h-6" style={{ color: "#1fC158" }} />
      </a>
    </div>
  );
}
