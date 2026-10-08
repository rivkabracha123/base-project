import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Request body for POST /api/buyer-chat/message — a buyer's outgoing message.
export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsIn(['en', 'he'])
  language!: 'en' | 'he';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;
}
