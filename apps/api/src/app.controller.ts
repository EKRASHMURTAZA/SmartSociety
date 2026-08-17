import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Sse,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { Observable, filter, map } from "rxjs";

import { AppService } from "./app.service";
import { NotificationStreamService } from "./notification-stream.service";
import {
  AuthGuard,
  AuthenticatedRequest,
} from "./auth/auth.guard";

class VisitorDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  vehicle?: string;

  @IsString()
  purpose!: string;

  @IsString()
  dateISO!: string;

  @IsString()
  entryTime!: string;

  @IsString()
  exitTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}

class ComplaintDto {
  @IsString()
  category!: string;

  @IsString()
  title!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  priority?: string;
}

class BookingDto {
  @IsString()
  amenityId!: string;

  @IsString()
  date!: string;

  @IsString()
  slot!: string;
}

class ProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

class VehicleDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsString()
  @MinLength(2)
  number!: string;
}

class HouseholdDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  relation!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class ContactDto {
  @IsString()
  @MinLength(2)
  label!: string;

  @IsString()
  phone!: string;
}

class StaffDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  role!: string;
}

class GenerateBillsDto {
  @IsString()
  @MinLength(3)
  period!: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

class VoteDto {
  @IsString()
  optionId!: string;
}

class VerifyQrDto {
  @IsString()
  @MinLength(8)
  token!: string;
}

class ChatDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  language?: string;
}

class KnowledgeDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  category!: string;

  @IsString()
  @MinLength(10)
  content!: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class KnowledgePatchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class SettingsDto {
  @IsString()
  key!: string;

  @IsString()
  value!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly notificationStream: NotificationStreamService,
  ) {}

  // ============================================================
  // PROFILE
  // ============================================================

  @Get("profile")
  profile(@Req() req: AuthenticatedRequest) {
    return this.app.profile(req.user.id);
  }

  @Patch("profile")
  profileUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() body: ProfileDto,
  ) {
    return this.app.updateProfile(req.user.id, body);
  }

  @Post("profile/vehicles")
  vehicleCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: VehicleDto,
  ) {
    return this.app.addVehicle(req.user.id, body);
  }

  @Delete("profile/vehicles/:id")
  vehicleRemove(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.removeVehicle(req.user.id, id);
  }

  @Post("profile/household")
  householdCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: HouseholdDto,
  ) {
    return this.app.addHousehold(req.user.id, body);
  }

  @Delete("profile/household/:id")
  householdRemove(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.removeHousehold(req.user.id, id);
  }

  @Post("profile/contacts")
  contactCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: ContactDto,
  ) {
    return this.app.addContact(req.user.id, body);
  }

  @Delete("profile/contacts/:id")
  contactRemove(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.removeContact(req.user.id, id);
  }

  // ============================================================
  // SOCIETY FLATS
  //
  // IMPORTANT:
  // AuthGuard explicitly allows /api/flats without login.
  // Registration page can therefore load this endpoint.
  // ============================================================

  @Get("flats")
  flats() {
    return this.app.flats();
  }

  // ============================================================
  // VISITORS
  // ============================================================

  @Get("visitors")
  visitors(
    @Req() req: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("date") date?: string,
    @Query("flat") flat?: string,
    @Query("search") search?: string,
    @Query("resident") resident?: string,
    @Query("vehicle") vehicle?: string,
  ) {
    return this.app.visitors(req.user.id, {
      status,
      date,
      flat,
      search,
      resident,
      vehicle,
    });
  }

  @Post("visitors")
  visitorCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: VisitorDto,
  ) {
    return this.app.createVisitor(req.user.id, body);
  }

  @Post("visitors/verify-qr")
  verifyQr(
    @Req() req: AuthenticatedRequest,
    @Body() body: VerifyQrDto,
  ) {
    return this.app.verifyQr(req.user.id, body.token);
  }

  @Patch("visitors/:id")
  visitorUpdate(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.updateVisitor(req.user.id, id, body);
  }

  @Post("visitors/:id/cancel")
  visitorCancel(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.cancelVisitor(req.user.id, id);
  }

  @Post("visitors/:id/check-in")
  visitorCheckIn(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.checkIn(req.user.id, id);
  }

  @Post("visitors/:id/check-out")
  visitorCheckOut(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.checkOut(req.user.id, id);
  }

  // ============================================================
  // GATE / VISITOR PASS
  // ============================================================

  @Post("gate/verify")
  verify(
    @Req() req: AuthenticatedRequest,
    @Body("code") code: string,
  ) {
    return this.app.verifyPass(req.user.id, String(code));
  }

  @Post("gate/:id/:action")
  gate(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("action")
    action: "allow" | "reject" | "exit",
  ) {
    if (!["allow", "reject", "exit"].includes(action)) {
      throw new Error("Unsupported action");
    }

    return this.app.gateAction(req.user.id, id, action);
  }

  @Get("gate/logs")
  gateLogs(@Req() req: AuthenticatedRequest) {
    return this.app.gateLogs(req.user.id);
  }

  // ============================================================
  // COMPLAINTS
  // ============================================================

  @Get("complaints")
  complaints(@Req() req: AuthenticatedRequest) {
    return this.app.complaints(req.user.id);
  }

  @Post("complaints")
  complaintCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: ComplaintDto,
  ) {
    return this.app.createComplaint(req.user.id, body);
  }

  @Patch("complaints/:id")
  complaintUpdate(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.updateComplaint(req.user.id, id, body);
  }

  // ============================================================
  // AMENITIES
  // ============================================================

  @Get("amenities")
  amenities() {
    return this.app.amenities();
  }

  // ============================================================
  // POLLS
  // ============================================================

  @Get("polls")
  polls(@Req() req: AuthenticatedRequest) {
    return this.app.polls(req.user.id);
  }

  @Post("polls/:id/vote")
  pollVote(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: VoteDto,
  ) {
    return this.app.votePoll(
      req.user.id,
      id,
      body.optionId,
    );
  }

  // ============================================================
  // BOOKINGS
  // ============================================================

  @Get("bookings")
  bookings(@Req() req: AuthenticatedRequest) {
    return this.app.bookings(req.user.id);
  }

  @Post("bookings")
  bookingCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: BookingDto,
  ) {
    return this.app.createBooking(req.user.id, body);
  }

  @Post("bookings/:id/cancel")
  bookingCancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.app.cancelBooking(req.user.id, id);
  }

  // ============================================================
  // BILLS
  // ============================================================

  @Get("bills")
  bills(@Req() req: AuthenticatedRequest) {
    return this.app.bills(req.user.id);
  }

  @Post("bills/:id/pay")
  pay(
    @Req() req: AuthenticatedRequest,
    @Param("id") billId: string,
    @Body("method") method: string,
  ) {
    return this.app.payBill(
      req.user.id,
      billId,
      method,
    );
  }

  // ============================================================
  // NOTICES
  // ============================================================

  @Get("notices")
  notices(@Req() req: AuthenticatedRequest) {
    return this.app.notices(req.user.id);
  }

  @Post("notices")
  noticeCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.createNotice(
      req.user.id,
      body,
    );
  }

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  @Get("notifications")
  notifications(@Req() req: AuthenticatedRequest) {
    return this.app.notifications(req.user.id);
  }

  @Patch("notifications/:id/read")
  notificationRead(
    @Req() req: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.app.markNotification(
      req.user.id,
      id,
    );
  }

  // ============================================================
  // EMERGENCY
  // ============================================================

  @Get("emergency")
  emergency(@Req() req: AuthenticatedRequest) {
    return this.app.emergency(req.user.id);
  }

  @Post("emergency")
  emergencyCreate(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.createEmergency(
      req.user.id,
      body,
    );
  }

  // ============================================================
  // ADMIN
  // ============================================================

  @Get("admin/overview")
  adminOverview(@Req() req: AuthenticatedRequest) {
    return this.app.adminOverview(req.user.id);
  }

  @Get("admin/residents")
  adminResidents(@Req() req: AuthenticatedRequest) {
    return this.app.adminResidents(req.user.id);
  }

  @Post("admin/residents")
  adminCreateResident(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.createResident(
      req.user.id,
      body,
    );
  }

  @Get("admin/staff")
  adminStaff(@Req() req: AuthenticatedRequest) {
    return this.app.staff(req.user.id);
  }

  @Post("admin/staff")
  adminCreateStaff(
    @Req() req: AuthenticatedRequest,
    @Body() body: StaffDto,
  ) {
    return this.app.createStaff(
      req.user.id,
      body,
    );
  }

  @Get("admin/billing")
  adminBilling(@Req() req: AuthenticatedRequest) {
    return this.app.billingStats(
      req.user.id,
    );
  }

  @Post("admin/bills/generate")
  adminGenerateBills(
    @Req() req: AuthenticatedRequest,
    @Body() body: GenerateBillsDto,
  ) {
    return this.app.generateBills(
      req.user.id,
      body,
    );
  }

  // ============================================================
  // SOCIETY CONFIG
  // (public: emergency numbers and basic society info)
  // ============================================================

  @Get("society")
  society() {
    return this.app.societyInfo();
  }

  @Get("society/emergency")
  societyEmergency() {
    return this.app.societyEmergencyContacts();
  }

  // ============================================================
  // AI ASSISTANT
  // ============================================================

  @Post("ai/chat")
  aiChat(@Req() req: AuthenticatedRequest, @Body() body: ChatDto) {
    return this.app.aiChat(req.user, body.message, body.language ?? "english");
  }

  @Get("ai/knowledge")
  aiKnowledge(@Req() req: AuthenticatedRequest, @Query("search") search?: string) {
    return this.app.knowledgeList(req.user, search);
  }

  @Post("ai/knowledge")
  aiKnowledgeCreate(@Req() req: AuthenticatedRequest, @Body() body: KnowledgeDto) {
    return this.app.knowledgeCreate(req.user, body);
  }

  @Patch("ai/knowledge/:id")
  aiKnowledgeUpdate(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: KnowledgePatchDto) {
    return this.app.knowledgeUpdate(req.user, id, body);
  }

  @Delete("ai/knowledge/:id")
  aiKnowledgeRemove(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.app.knowledgeRemove(req.user, id);
  }

  @Post("ai/knowledge/upload")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  aiKnowledgeUpload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Record<string, unknown>,
  ) {
    return this.app.knowledgeUpload(req.user, file, String(body.category ?? "Imported"));
  }

  // ============================================================
  // ADMIN: SETTINGS + EMERGENCY CONFIG
  // ============================================================

  @Get("admin/settings")
  adminSettings(@Req() req: AuthenticatedRequest) {
    return this.app.adminSettings(req.user);
  }

  @Patch("admin/settings")
  adminSettingsUpdate(@Req() req: AuthenticatedRequest, @Body() body: { settings: SettingsDto[] }) {
    return this.app.adminUpdateSettings(req.user, body.settings ?? []);
  }

  @Post("admin/emergency")
  adminEmergencyCreate(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.app.adminEmergencyCreate(req.user, body);
  }

  @Patch("admin/emergency/:id")
  adminEmergencyUpdate(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.app.adminEmergencyUpdate(req.user, id, body);
  }

  @Delete("admin/emergency/:id")
  adminEmergencyRemove(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.app.adminEmergencyRemove(req.user, id);
  }

  // ============================================================
  // REAL-TIME NOTIFICATION STREAM
  // ============================================================

  @Sse("notifications/stream")
  stream(
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    return this.notificationStream.events$.pipe(
      filter(
        (event) =>
          event.userId === req.user.id,
      ),
      map(
        (event) =>
          ({
            data: event.data,
            type: "notification",
          }) as MessageEvent,
      ),
    );
  }

  emitNotification(
    userId: string,
    data: unknown,
  ) {
    this.notificationStream.emit(
      userId,
      data,
    );
  }
}