import { useState } from "react"
import { GalleryScreen, type ScreenId } from "@/screens/GalleryScreen"
import { HomePregnancyScreen } from "@/screens/HomePregnancyScreen"
import { BirthDateScreen } from "@/screens/BirthDateScreen"
import {
  M01_Signup,
  M02_Q1_Pregnancy,
  M03_Q2_Children,
  M04_A1_Count,
  M05_A2_FetusInfo,
  M06_A3_Purpose,
  M07_B0_Intro1,
  M08_B1_Count,
  M09_B2_ChildrenInfo,
  M10_B3_Intro2,
  M11_B4_PregnancyCount,
  M12_B5_FetusInfo,
  M13_B6_Purpose,
  M14_C1_Count,
  M15_C2_ChildInfo,
  M16_C3_Purpose,
} from "@/screens/Onboarding"
import {
  M18_HomeMultiChild,
  M19_VoiceRecording,
  M20_STTEdit,
  M21_MediaAttach,
  M22_RecordComplete,
} from "@/screens/DailyRecording"
import {
  M23_BirthConfirmModal,
  M25_SettingsBanner,
  M26_ParentModeHome,
} from "@/screens/BirthConversion"
import {
  M27_NarrativeRequest,
  M28_NarrativeLoading,
  M29_NarrativePreview,
  M30_NarrativeEdit,
} from "@/screens/AINarrative"
import {
  M31_BookLayout,
  M32_BookPreview,
  M33_BookCheckout,
  M34_BookTracking,
} from "@/screens/BookProduction"
import {
  M35_DiaryList,
  M36_DiaryListEmpty,
} from "@/screens/DiaryList"

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("gallery")
  const back = () => setScreen("gallery")

  const Phone = (Screen: React.ComponentType<{ onBack: () => void }>) => (
    <div className="py-8 flex justify-center">
      <Screen onBack={back} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#E8DFD3]">
      {screen === "gallery" && <GalleryScreen onNavigate={setScreen} />}
      {screen === "home" && Phone(HomePregnancyScreen)}
      {screen === "birth" && Phone(BirthDateScreen)}

      {screen === "M01" && Phone(M01_Signup)}
      {screen === "M02" && Phone(M02_Q1_Pregnancy)}
      {screen === "M03" && Phone(M03_Q2_Children)}
      {screen === "M04" && Phone(M04_A1_Count)}
      {screen === "M05" && Phone(M05_A2_FetusInfo)}
      {screen === "M06" && Phone(M06_A3_Purpose)}
      {screen === "M07" && Phone(M07_B0_Intro1)}
      {screen === "M08" && Phone(M08_B1_Count)}
      {screen === "M09" && Phone(M09_B2_ChildrenInfo)}
      {screen === "M10" && Phone(M10_B3_Intro2)}
      {screen === "M11" && Phone(M11_B4_PregnancyCount)}
      {screen === "M12" && Phone(M12_B5_FetusInfo)}
      {screen === "M13" && Phone(M13_B6_Purpose)}
      {screen === "M14" && Phone(M14_C1_Count)}
      {screen === "M15" && Phone(M15_C2_ChildInfo)}
      {screen === "M16" && Phone(M16_C3_Purpose)}

      {screen === "M18" && Phone(M18_HomeMultiChild)}
      {screen === "M19" && Phone(M19_VoiceRecording)}
      {screen === "M20" && Phone(M20_STTEdit)}
      {screen === "M21" && Phone(M21_MediaAttach)}
      {screen === "M22" && Phone(M22_RecordComplete)}

      {screen === "M23" && Phone(M23_BirthConfirmModal)}
      {screen === "M25" && Phone(M25_SettingsBanner)}
      {screen === "M26" && Phone(M26_ParentModeHome)}

      {screen === "M27" && Phone(M27_NarrativeRequest)}
      {screen === "M28" && Phone(M28_NarrativeLoading)}
      {screen === "M29" && Phone(M29_NarrativePreview)}
      {screen === "M30" && Phone(M30_NarrativeEdit)}

      {screen === "M31" && Phone(M31_BookLayout)}
      {screen === "M32" && Phone(M32_BookPreview)}
      {screen === "M33" && Phone(M33_BookCheckout)}
      {screen === "M34" && Phone(M34_BookTracking)}

      {screen === "M35" && Phone(M35_DiaryList)}
      {screen === "M36" && Phone(M36_DiaryListEmpty)}
    </div>
  )
}
