import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  BellOff,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Database,
  Keyboard,
  ListTodo,
  Monitor,
  Rocket,
  Search,
  Timer,
  Waves,
} from "lucide-react";
import { Card } from "./ui";
import { cn } from "../lib/cn";

interface Topic {
  title: string;
  icon: ReactNode;
  intro: string;
  points: string[];
}

/** In-app handbook: one collapsible entry per module. */
const TOPICS: Topic[] = [
  {
    title: "番茄钟",
    icon: <Timer size={15} />,
    intro: "专注与休息的节奏控制",
    points: [
      "顶部先选阶段：专注或休息；休息下可再选「短休息」「长休息」。",
      "「经典 25/5」「深度 50/10」「冲刺 15/3」可一键套用，也可自行微调时长。",
      "各时长数字可直接键盘输入，回车或点击别处生效。",
      "专注阶段可切换「正计时」：不设时长，点「结束并记录」后按实际分钟计入统计。",
      "运行中可暂停、重置或跳过；每完成 N 个番茄自动进入长休息，N 在「时长预设」里调整。",
      "在计时区关联一个待办后，完成的番茄会累计到该任务。",
    ],
  },
  {
    title: "待办清单",
    icon: <ListTodo size={15} />,
    intro: "拆分任务，用番茄推进",
    points: [
      "输入标题后回车即可快速添加，可设置番茄预估数、优先级与标签。",
      "展开「子步骤」把任务拆小，拖动可调整步骤顺序。",
      "勾完最后一步会自动完成父任务；取消任一步骤则父任务重新打开。",
      "设为「每日重复」后，跨天会自动重置为未完成并清空子步骤。",
      "点标签可按标签筛选，帮助快速聚焦同一类任务。",
    ],
  },
  {
    title: "倒数日",
    icon: <CalendarDays size={15} />,
    intro: "阳历 / 阴历事件与桌面倒计时",
    points: [
      "填写事件名称与目标日期，并可选择一个标记色。",
      "目标日期可切换阳历 / 阴历，阴历支持闰月；阴历事件只支持「不重复」与「每年」两种重复。",
      "重复周期支持 不重复 / 每周 / 每月 / 每年 / 每 N 天，自定义间隔为 1–3650 天的整数。",
      "卡片风格可选「经典」或「流浪地球」：后者为黑底海报样式，用超大数字与英文副标题突出剩余时间。",
      "卡片右上角的图钉会为这条倒数日单独开一个桌面小部件（可拖动、记住位置），再点一次收回。",
      "编辑按钮可改名称、日期、配色与风格；置顶事件会优先显示在桌面小组件上。",
    ],
  },
  {
    title: "统计",
    icon: <BarChart3 size={15} />,
    intro: "专注趋势、热力图与分享图",
    points: [
      "顶部「统计范围」在近 7 天 / 30 天 / 12 个月之间切换，页面图表与导出图会同步变化。",
      "柱状图看专注趋势，热力图看每天（或每月）的专注分布。",
      "「专注目标」显示今日与本周进度，可在「设置 → 专注目标」调整每日 / 每周目标分钟。",
      "「时间花在哪」按任务与标签拆分钟，标签统计会把同一任务计入它的每个标签。",
      "点「导出图片」生成一张 2 倍分辨率的 PNG 分享图，深色模式与强调色会自动跟随。",
    ],
  },
  {
    title: "桌面小组件",
    icon: <Monitor size={15} />,
    intro: "皮肤、透明度、位置与显示内容",
    points: [
      "在「设置 → 桌面小组件」选择皮肤、尺寸与要显示的内容块；皮肤有玻璃 / 纯色 / 描边 / 幽灵四种。",
      "「背景不透明度」只调整面板与背景图，文字始终清晰可读。",
      "选择自定义背景图片后，可用「背景遮罩」压暗图片，保证文字在亮图上也看得清。",
      "拖动标题栏的 FocusDay 区域即可移动小组件；锁定位置后无法拖动，以防误触。",
      "位置会被记住并在下次启动时还原；标题栏右侧可打开主窗口或隐藏小组件。",
    ],
  },
  {
    title: "白噪音",
    icon: <Waves size={15} />,
    intro: "计时自动播放的环境音",
    points: [
      "可选白噪音 / 粉红 / 棕 / 雨声 / 咖啡厅，计时开始时自动播放，暂停或结束时自动停止。",
      "雨声与咖啡厅为实时合成的近似音效，可用「音色亮度」「低频厚度」微调听感。",
      "音量滑杆即时生效，调整结果会自动保存。",
    ],
  },
  {
    title: "专注时免打扰",
    icon: <BellOff size={15} />,
    intro: "专注期间不打扰",
    points: [
      "开启后，专注进行中 FocusDay 不再播放提示音或弹出系统通知，主界面会显示「免打扰中」。",
      "Windows 未向第三方程序开放切换系统级勿扰（专注助手）的接口，如需全局免打扰请点「打开系统设置」，由你在系统中开启。",
    ],
  },
  {
    title: "托盘与快捷键",
    icon: <Keyboard size={15} />,
    intro: "后台运行与随时唤起",
    points: [
      "鼠标悬停托盘图标可查看剩余时间与今日番茄数，图标本身会绘制进度环与剩余分钟。",
      "左键点击托盘打开主窗口，右键菜单可显示 / 隐藏小组件或退出 FocusDay。",
      "在「设置 → 全局快捷键」中选择组合键，即可在任意界面唤起主窗口；组合键被占用时会提示注册失败并自动关闭。",
    ],
  },
  {
    title: "更新",
    icon: <Rocket size={15} />,
    intro: "获取最新安装包",
    points: [
      "在「设置 → 更新」点「打开更新页面」，会用系统默认浏览器打开 GitHub Releases，不会弹出命令窗口。",
      "在 Releases 页面下载最新的 Windows 安装包（.exe 或 .msi）即可覆盖安装，数据会保留。",
      "当前版本号显示在更新区域与设置页底部。",
    ],
  },
  {
    title: "数据与备份",
    icon: <Database size={15} />,
    intro: "本地存储与导入导出",
    points: [
      "所有数据都保存在本地；可在「数据」中导出 JSON 备份，或从备份文件恢复。",
      "导入备份会覆盖当前全部数据；「重置全部数据」会清空待办、倒数日与统计记录，操作不可撤销。",
      "升级版本或更换设备前，建议先导出一份备份。",
    ],
  },
];

export default function ManualSection() {
  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const keyword = query.trim().toLowerCase();
  const allOpen = openKeys.size === TOPICS.length;

  const entries = useMemo(() => {
    if (!keyword) return TOPICS.map((topic) => ({ topic, points: topic.points }));
    return TOPICS.map((topic) => {
      const topicHit = `${topic.title} ${topic.intro}`.toLowerCase().includes(keyword);
      const points = topicHit
        ? topic.points
        : topic.points.filter((point) => point.toLowerCase().includes(keyword));
      return { topic, points };
    }).filter((entry) => entry.points.length > 0);
  }, [keyword]);

  const toggle = (title: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const toggleAll = () => {
    setOpenKeys(allOpen ? new Set() : new Set(TOPICS.map((topic) => topic.title)));
  };

  return (
    <Card className="fd-pop p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-brand">
          <BookOpen size={16} />
        </span>
        使用手册
        <span className="ml-auto text-[11px] font-normal text-muted">共 {TOPICS.length} 个主题</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索功能，例如「阴历」「导出」「快捷键」"
            className="w-full rounded-xl border border-line bg-card py-2 pr-3 pl-9 text-xs text-ink transition-colors placeholder:text-muted focus:border-brand/40 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-solid hover:text-ink"
        >
          {allOpen ? "全部收起" : "全部展开"}
        </button>
      </div>

      <div className="mt-2 divide-y divide-line">
        {entries.map(({ topic, points }) => {
          const open = keyword !== "" || openKeys.has(topic.title);
          return (
            <div key={topic.title}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  if (!keyword) toggle(topic.title);
                }}
                className="group flex w-full items-center gap-3 py-3 text-left"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  {topic.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink transition-colors group-hover:text-brand">
                    {topic.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {topic.intro}
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  className={cn(
                    "shrink-0 text-muted transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open ? (
                <ul className="mb-3 flex flex-col gap-2 pl-1">
                  {points.map((point) => (
                    <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">没有找到相关条目，换个关键词试试</p>
        ) : null}
      </div>
    </Card>
  );
}
