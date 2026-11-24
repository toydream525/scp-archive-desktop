; Custom SCP Foundation RAISA Terminal branding for NSIS installer
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "SCP Archive 档案终端部署向导"
  !define MUI_WELCOMEPAGE_TEXT "欢迎部署 SCP Archive（v1.0.1）—— 开源 SCP 基金会维基 PC 阅读客户端。$\r$\n$\r$\nSECURE · CONTAIN · PROTECT$\r$\n$\r$\n· 支持 CN 中文分部与 EN 英文主站双站对照$\r$\n· 纯净排版与原版特效双模式、分批次离线归档$\r$\n· 安装后双击桌面图标即可秒开，无需每次解包$\r$\n$\r$\n点击 [下一步] 继续完成终端部署。"
  !define MUI_FINISHPAGE_TITLE "SCP Archive 终端部署完成"
  !define MUI_FINISHPAGE_TEXT "SCP Archive 已部署至当前计算机。$\r$\n$\r$\nCLEARANCE LEVEL 2 // ACCESS GRANTED$\r$\n$\r$\n客户端代码采用 MIT 协议开源，SCP 相关内容遵循 CC BY-SA 3.0。"
  !define MUI_FINISHPAGE_RUN_TEXT "立即启动 SCP Archive 档案终端"
!macroend
