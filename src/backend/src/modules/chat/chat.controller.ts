import { Body, Controller, Get, Optional, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISOS } from '../../common/rbac';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermisosGuard } from '../../common/guards/permisos.guard';
import { ExigirPermisos } from '../../common/decorators/permisos.decorator';
import { LimiteIntentosService, REGLAS } from '../../common/seguridad/limite-intentos.service';
import { Usuario, UsuarioActual } from '../../common/usuario-actual.decorator';
import { ChatService } from './chat.service';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { ListarMensajesDto } from './dto/listar-mensajes.dto';

/**
 * Chat en vivo del equipo. El envio y la lectura van por HTTP para que queden
 * persistidos aunque el socket este caido; la difusion en tiempo real y la
 * presencia salen por ChatGateway (namespace /chat).
 */
@ApiTags('chat')
@UseGuards(JwtAuthGuard, PermisosGuard)
@ExigirPermisos(PERMISOS.CHAT_USAR)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    @Optional() private readonly limites?: LimiteIntentosService,
  ) {}

  @Get('contactos')
  contactos(@Usuario() u: UsuarioActual) {
    return this.chat.contactos(u);
  }

  @Get('no-leidos')
  noLeidos(@Usuario() u: UsuarioActual) {
    return this.chat.noLeidos(u);
  }

  @Get('mensajes')
  mensajes(@Usuario() u: UsuarioActual, @Query() dto: ListarMensajesDto) {
    return this.chat.mensajes(u, dto);
  }

  @Post('mensajes')
  enviar(@Usuario() u: UsuarioActual, @Body() dto: EnviarMensajeDto) {
    this.limites?.consumir(`chat:${u.id}`, REGLAS.mensajeChat);
    return this.chat.enviar(u, dto);
  }

  @Post('leidos/:emisorId')
  marcarLeidos(@Usuario() u: UsuarioActual, @Param('emisorId', ParseUUIDPipe) emisorId: string) {
    return this.chat.marcarLeidos(u, emisorId);
  }
}
