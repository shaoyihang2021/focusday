import { BookOpen, ChevronDown } from "lucide-react";
import { Card } from "./ui";

interface Topic {
  title: string;
  points: string[];
}

/** In-app handbook: one collapsible entry per module. */
const TOPICS: Topic[] = [
  {
    title: "番茄钟",
    points: [
      "顶部可在专注 / 短休息 / 长休息之间切换，点「开始专注」运行，也可暂停、重置或跳过。",
      "先在上方关联「当前专注任务」，完成的番茄会累计到这条待办上。",
      "每完成 N 个番茄进入长休息，N 可在「时长设置」里调整。",
      "每段结束会播放提示音并推送系统通知，二者可在「提醒与行为」中分别关闭。",
    ],
  },
  {
    title: "待办清单",
    points: [
      "输入后回车即可快速添加，可设置番茄预估数、优先级与标签。",
      "展开「子步骤」把任务拆小，拖动可调整步骤顺序。",
      "勾完最后一步会自动完成父任务；取消任一步骤则父任务重新打开。",
      "设为「每日重复」后，跨天会自动重置为未完成并清空子步骤。",
    ],
  },
  {
    title: "倒数日",
    points: [
      "填写事件名称与目标日期，并可选择一个标记色。",
      "卡片风格可选「经典」或「流浪地球」：后者为黑底海报样式，用超大数字与英文副标题突出剩余时间。",
      "重复周期支持 不重复 / 每周 / 每月 / 每年 / 每 N 天，自定义间隔为 1–3650 天的整数。",
      "置顶的倒数日会一并显示在桌面小组件上。",
    ],
  },
  {
    title: "统计",
    points: [
      "顶部「统计范围」在近 7 天 / 30 天 / 12 个月之间切换，页面图表与导出图会同步变化。",
      "柱状图看专注趋势，热力图看每天（或每月）的专注分布。",
      "点「导出图片」生成一张 PNG 分享图，深色模式与强调色会自动跟随。",
    ],
  },
  {
    title: "桌面小组件",
    points: [
      "在「桌面小组件」中选择皮肤、尺寸与不透明度，并勾选要显示的内容块。",
      "锁定位置后无法拖动以防误触；位置会被记住并在下次启动时还原。",
    ],
  },
  {
    title: "白噪音",
    points: [
      "可选白噪音 / 粉红 / 棕 / 雨声 / 咖啡厅，计时开始时自动播放，暂停或结束时自动停止。",
      "雨声与咖啡厅为实时合成的近似音效，可用「音色亮度」「低频厚度」微调听感。",
    ],
  },
  {
    title: "专注时免打扰",
    points: [
      "开启后，专注进行中 FocusDay 不再播放提示音或弹出系统通知，主界面会显示「免打扰中」。",
      "Windows 未向第三方程序开放切换系统级勿扰（专注助手）的接口，如需全局免打扰请点「打开系统设置」，由你在系统中开启。",
    ],
  },
  {
    title: "托盘与全局快捷键",
    points: [
      "鼠标悬停托盘图标可查看剩余时间与今日番茄数，图标本身会绘制进度环与剩余分钟。",
      "左键点击托盘打开主窗口，右键菜单可显示 / 隐藏小组件或退出 FocusDay。",
      "在「全局快捷键」中选择组合键，即可在任意界面唤起主窗口。",
    ],
  },
  {
    title: "数据与备份",
    points: [
      "所有数据都保存在本地；可在「数据」中导出 JSON 备份，或从备份文件恢复。",
      "「重置全部数据」会清空待办、倒数日与统计记录，操作不可撤销。",
    ],
  },
];

export default function ManualSection() {
  return (
    <Card className="fd-pop p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="text-brand">
          <BookOpen size={16} />
        </span>
        使用手册
      </div>
      <p className="mb-1 text-xs text-muted">点标题展开，查看各模块的用法与要点</p>
      <div className="divide-y divide-line">
        {TOPICS.map((topic) => (
          <details key={topic.title} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-ink transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
              {topic.title}
              <ChevronDown
                size={15}
                className="shrink-0 text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="mb-3 flex flex-col gap-2 pl-1">
              {topic.points.map((point) => (
                <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                  {point}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </Card>
  );
}
