import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  GraduationCap,
  School,
  Wand2,
  BookOpen,
  ImagePlus,
  Lightbulb,
  ClipboardCheck,
  HelpCircle,
  BarChart2,
  SlidersHorizontal,
  Brain,
  Send,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFileInfo {
  base64Data: string;
  fileName: string;
  mimeType: string;
  id: string;
}

interface SmartInputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  context: "chat" | "tools" | "course" | "dashboard";
  persona: string;
  onFileUpload?: (file: File) => void;
  uploadedFiles?: UploadedFileInfo[];
  onRemoveFile?: (id: string) => void;
  isLoading?: boolean;
  language: "ar" | "en";
  placeholder?: string;
  onSettingsChange?: (settings: SmartSettings) => void;
}

export type { SmartSettings };

interface SmartSettings {
  learningMode: "auto" | "student" | "teacher";
  studyTool: "pack" | "image" | "explain" | null;
  assessment: "exam" | "whyWrong" | "insights" | null;
  difficulty: number;
  memoryEnabled: boolean;
}

const STORAGE_KEY = "smart-input-settings";

const getDefaultSettings = (): SmartSettings => ({
  learningMode: "auto",
  studyTool: null,
  assessment: null,
  difficulty: 50,
  memoryEnabled: true,
});

const loadSettings = (): SmartSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...getDefaultSettings(), ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return getDefaultSettings();
};

const saveSettings = (settings: SmartSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
};

export function SmartInputBox({
  value,
  onChange,
  onSubmit,
  context,
  persona,
  onFileUpload,
  uploadedFiles = [],
  onRemoveFile,
  isLoading = false,
  language,
  placeholder,
  onSettingsChange,
}: SmartInputBoxProps) {
  const [settings, setSettings] = useState<SmartSettings>(loadSettings);
  const [learningOpen, setLearningOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRTL = language === "ar";
  const hasInitializedPersona = useRef(false);

  // Determine which icon groups to show based on context
  const showLearningMode = context === "chat" || context === "dashboard";
  const showStudyTools = context === "chat" || context === "tools" || context === "dashboard";
  const showAssessment = context === "chat" || context === "course";
  const showOptions = context === "chat" || context === "dashboard";

  // Auto-select settings based on persona on initial mount
  useEffect(() => {
    if (hasInitializedPersona.current) return;
    hasInitializedPersona.current = true;

    let newSettings = { ...settings };
    let changed = false;

    if (persona === "quizzes") {
      newSettings.assessment = "exam";
      changed = true;
    } else if (persona === "research") {
      newSettings.studyTool = "pack";
      changed = true;
    } else if (persona === "doctor" || persona === "scientific-assistant") {
      newSettings.studyTool = "explain";
      changed = true;
    }

    if (changed) {
      setSettings(newSettings);
    }
  }, [persona]);

  // Save settings and notify parent when settings change
  useEffect(() => {
    saveSettings(settings);
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    e.target.value = "";
  };

  const updateSetting = useCallback(<K extends keyof SmartSettings>(key: K, val: SmartSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }, []);

  const getLearningModeIcon = () => {
    switch (settings.learningMode) {
      case "student":
        return <GraduationCap className="w-4 h-4" />;
      case "teacher":
        return <School className="w-4 h-4" />;
      default:
        return <Wand2 className="w-4 h-4" />;
    }
  };

  const getStudyToolIcon = () => {
    switch (settings.studyTool) {
      case "pack":
        return <BookOpen className="w-4 h-4" />;
      case "image":
        return <ImagePlus className="w-4 h-4" />;
      case "explain":
        return <Lightbulb className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4 opacity-50" />;
    }
  };

  const getAssessmentIcon = () => {
    switch (settings.assessment) {
      case "exam":
        return <ClipboardCheck className="w-4 h-4" />;
      case "whyWrong":
        return <HelpCircle className="w-4 h-4" />;
      case "insights":
        return <BarChart2 className="w-4 h-4" />;
      default:
        return <ClipboardCheck className="w-4 h-4 opacity-50" />;
    }
  };

  const labels = {
    ar: {
      auto: "تلقائي",
      student: "طالب",
      teacher: "معلم",
      pack: "حزمة الدراسة",
      image: "صورة إلى درس",
      explain: "اشرح هذا",
      exam: "محاكي الامتحان",
      whyWrong: "لماذا خطأ؟",
      insights: "تحليلات",
      difficulty: "الصعوبة",
      memory: "الذاكرة",
      learningMode: "وضع التعلم",
      studyTools: "أدوات الدراسة",
      assessment: "التقييم",
      options: "خيارات",
      send: "إرسال",
      upload: "رفع ملف",
      placeholder: "اكتب رسالتك هنا...",
    },
    en: {
      auto: "Auto",
      student: "Student",
      teacher: "Teacher",
      pack: "Study Pack",
      image: "Image to Lesson",
      explain: "Explain This",
      exam: "Exam Simulator",
      whyWrong: "Why Wrong?",
      insights: "Insights",
      difficulty: "Difficulty",
      memory: "Memory",
      learningMode: "Learning Mode",
      studyTools: "Study Tools",
      assessment: "Assessment",
      options: "Options",
      send: "Send",
      upload: "Upload file",
      placeholder: "Type your message here...",
    },
  };

  const t = labels[language];

  const PopoverButton = ({
    children,
    tooltip,
    isActive,
    ...props
  }: {
    children: React.ReactNode;
    tooltip: string;
    isActive?: boolean;
  } & React.ComponentProps<typeof Button>) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 rounded-full flex-shrink-0",
            isActive && "text-primary bg-primary/10"
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={isRTL ? "right" : "left"}>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );

  const PopoverItem = ({
    icon,
    label,
    isSelected,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    isSelected?: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors",
        "hover-elevate",
        isSelected && "bg-primary/20 text-primary"
      )}
      data-testid={`popover-item-${label}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="w-full" dir={isRTL ? "rtl" : "ltr"}>
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground text-xs"
              data-testid={`uploaded-file-${file.id}`}
            >
              <span className="max-w-[100px] truncate">{file.fileName}</span>
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.id)}
                  className="hover:text-destructive"
                  data-testid={`remove-file-${file.id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative flex items-center gap-1 px-2",
          "rounded-full border border-input bg-background/80 backdrop-blur-sm",
          "focus-within:ring-2 focus-within:ring-ring focus-within:border-primary",
          "neon-input-container transition-all duration-200"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.txt"
          data-testid="file-input"
        />

        <div className={cn("flex items-center gap-0.5 py-1", isRTL ? "order-first" : "order-last")}>
          {showLearningMode && (
            <Popover open={learningOpen} onOpenChange={setLearningOpen}>
              <PopoverTrigger asChild>
                <div>
                  <PopoverButton
                    tooltip={t.learningMode}
                    isActive={settings.learningMode !== "auto"}
                    data-testid="btn-learning-mode"
                  >
                    {getLearningModeIcon()}
                  </PopoverButton>
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-44 p-2"
                side={isRTL ? "left" : "right"}
                align="start"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t.learningMode}</p>
                  <PopoverItem
                    icon={<Wand2 className="w-4 h-4" />}
                    label={t.auto}
                    isSelected={settings.learningMode === "auto"}
                    onClick={() => {
                      updateSetting("learningMode", "auto");
                      setLearningOpen(false);
                    }}
                  />
                  <PopoverItem
                    icon={<GraduationCap className="w-4 h-4" />}
                    label={t.student}
                    isSelected={settings.learningMode === "student"}
                    onClick={() => {
                      updateSetting("learningMode", "student");
                      setLearningOpen(false);
                    }}
                  />
                  <PopoverItem
                    icon={<School className="w-4 h-4" />}
                    label={t.teacher}
                    isSelected={settings.learningMode === "teacher"}
                    onClick={() => {
                      updateSetting("learningMode", "teacher");
                      setLearningOpen(false);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {showStudyTools && (
            <Popover open={studyOpen} onOpenChange={setStudyOpen}>
            <PopoverTrigger asChild>
              <div>
                <PopoverButton
                  tooltip={t.studyTools}
                  isActive={settings.studyTool !== null}
                  data-testid="btn-study-tools"
                >
                  {getStudyToolIcon()}
                </PopoverButton>
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-48 p-2"
              side={isRTL ? "left" : "right"}
              align="start"
            >
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t.studyTools}</p>
                <PopoverItem
                  icon={<BookOpen className="w-4 h-4" />}
                  label={t.pack}
                  isSelected={settings.studyTool === "pack"}
                  onClick={() => {
                    updateSetting("studyTool", settings.studyTool === "pack" ? null : "pack");
                    setStudyOpen(false);
                  }}
                />
                <PopoverItem
                  icon={<ImagePlus className="w-4 h-4" />}
                  label={t.image}
                  isSelected={settings.studyTool === "image"}
                  onClick={() => {
                    updateSetting("studyTool", settings.studyTool === "image" ? null : "image");
                    setStudyOpen(false);
                  }}
                />
                <PopoverItem
                  icon={<Lightbulb className="w-4 h-4" />}
                  label={t.explain}
                  isSelected={settings.studyTool === "explain"}
                  onClick={() => {
                    updateSetting("studyTool", settings.studyTool === "explain" ? null : "explain");
                    setStudyOpen(false);
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          )}

          {showAssessment && (
            <Popover open={assessmentOpen} onOpenChange={setAssessmentOpen}>
              <PopoverTrigger asChild>
                <div>
                  <PopoverButton
                    tooltip={t.assessment}
                    isActive={settings.assessment !== null}
                    data-testid="btn-assessment"
                  >
                    {getAssessmentIcon()}
                  </PopoverButton>
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-48 p-2"
                side={isRTL ? "left" : "right"}
                align="start"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 pb-1">{t.assessment}</p>
                  <PopoverItem
                    icon={<ClipboardCheck className="w-4 h-4" />}
                    label={t.exam}
                    isSelected={settings.assessment === "exam"}
                    onClick={() => {
                      updateSetting("assessment", settings.assessment === "exam" ? null : "exam");
                      setAssessmentOpen(false);
                    }}
                  />
                  <PopoverItem
                    icon={<HelpCircle className="w-4 h-4" />}
                    label={t.whyWrong}
                    isSelected={settings.assessment === "whyWrong"}
                    onClick={() => {
                      updateSetting("assessment", settings.assessment === "whyWrong" ? null : "whyWrong");
                      setAssessmentOpen(false);
                    }}
                  />
                  <PopoverItem
                    icon={<BarChart2 className="w-4 h-4" />}
                    label={t.insights}
                    isSelected={settings.assessment === "insights"}
                    onClick={() => {
                      updateSetting("assessment", settings.assessment === "insights" ? null : "insights");
                      setAssessmentOpen(false);
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
          )}

          {showOptions && (
            <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
              <PopoverTrigger asChild>
                <div>
                  <PopoverButton
                    tooltip={t.options}
                    isActive={settings.difficulty !== 50 || !settings.memoryEnabled}
                    data-testid="btn-options"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </PopoverButton>
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-56 p-3"
                side={isRTL ? "left" : "right"}
                align="start"
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {t.difficulty}
                      </span>
                      <span className="text-xs text-muted-foreground">{settings.difficulty}%</span>
                    </div>
                    <Slider
                      value={[settings.difficulty]}
                      onValueChange={([val]) => updateSetting("difficulty", val)}
                      max={100}
                      step={10}
                      className="w-full"
                      data-testid="slider-difficulty"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      {t.memory}
                    </span>
                    <Switch
                      checked={settings.memoryEnabled}
                      onCheckedChange={(checked) => updateSetting("memoryEnabled", checked)}
                      data-testid="switch-memory"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {onFileUpload && (
            <PopoverButton
              tooltip={t.upload}
              onClick={handleFileClick}
              data-testid="btn-upload"
            >
              <Upload className="w-4 h-4" />
            </PopoverButton>
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t.placeholder}
          disabled={isLoading}
          className={cn(
            "flex-1 h-11 bg-transparent border-0 outline-none text-base",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isRTL ? "text-right pr-2" : "text-left pl-2"
          )}
          data-testid="input-message"
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onSubmit}
          disabled={isLoading || !value.trim()}
          className={cn(
            "h-8 w-8 rounded-full flex-shrink-0",
            value.trim() && !isLoading && "text-primary"
          )}
          data-testid="btn-send"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className={cn("w-4 h-4", isRTL && "rotate-180")} />
          )}
        </Button>
      </div>
    </div>
  );
}
