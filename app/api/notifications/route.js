import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { NotificationService } from "@/lib/notification-service"

export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notificationService = new NotificationService()
    const notifications = await notificationService.getUserNotifications(user.id)

    return NextResponse.json({ notifications })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
