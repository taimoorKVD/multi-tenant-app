import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {DataSource, Raw, Repository} from 'typeorm';
import {
  Vendor,
  VendorContact,
  VendorOrderDay,
  VendorOrderDeadline,
  VendorPaymentMethod,
} from './entities';
import {TenantAbstractService} from '../../common/abstract';
import {
  CreateVendorContactDto,
  CreateVendorDto,
  CreateVendorOrderDeadlineDto,
  UpdateVendorDto,
} from './dto';

@Injectable()
export class VendorsService extends TenantAbstractService<Vendor> {
  constructor(private readonly dataSource: DataSource) {
    super(dataSource.getRepository(Vendor));
  }

  private async findByName(repo: Repository<Vendor>, name: string) {
    return repo.findOne({
      where: {
        name: Raw((alias) => `LOWER(${alias}) = LOWER(:name)`, {name}),
      } as any,
    });
  }

  private normalizePaymentMethods(dto: Pick<CreateVendorDto, 'payment_cod' | 'payment_eft' | 'payment_methods'>) {
    const paymentMethods = new Set<VendorPaymentMethod>(dto.payment_methods ?? []);

    if (dto.payment_cod) {
      paymentMethods.add(VendorPaymentMethod.COD);
    }

    if (dto.payment_eft) {
      paymentMethods.add(VendorPaymentMethod.EFT);
    }

    return paymentMethods.size ? Array.from(paymentMethods) : null;
  }

  private normalizeOrderDeadlineDays(days?: VendorOrderDay[]) {
    return days?.length ? Array.from(new Set(days)) : [];
  }

  private mapContact(contact: CreateVendorContactDto, fallbackPrimary = false): VendorContact {
    const entity = new VendorContact();
    entity.name = contact.name.trim();
    entity.phoneNumber = contact.phone_number?.trim() || null;
    entity.email = contact.email?.trim().toLowerCase() || null;
    entity.isPrimary = contact.is_primary ?? fallbackPrimary;
    return entity;
  }

  private buildContacts(dto: Pick<CreateVendorDto, 'contact_person' | 'contact_phone' | 'contact_email' | 'contacts'>) {
    if (dto.contacts?.length) {
      return dto.contacts.map((contact, index) => this.mapContact(contact, index === 0));
    }

    if (dto.contact_person || dto.contact_phone || dto.contact_email) {
      return [
        this.mapContact(
          {
            name: dto.contact_person ?? 'Primary Contact',
            phone_number: dto.contact_phone,
            email: dto.contact_email,
            is_primary: true,
          },
          true,
        ),
      ];
    }

    return [];
  }

  private mapOrderDeadline(deadline: CreateVendorOrderDeadlineDto): VendorOrderDeadline {
    const entity = new VendorOrderDeadline();
    entity.day = deadline.day;
    return entity;
  }

  private buildOrderDeadlines(
    dto: Pick<CreateVendorDto, 'order_deadline_days' | 'order_deadlines'>,
  ): VendorOrderDeadline[] {
    const days = dto.order_deadlines?.length
      ? dto.order_deadlines.map((deadline) => deadline.day)
      : this.normalizeOrderDeadlineDays(dto.order_deadline_days);

    return Array.from(new Set(days)).map((day) => this.mapOrderDeadline({day}));
  }

  private async loadVendor(repo: Repository<Vendor>, id: number) {
    return repo.findOne({
      where: {id} as any,
      relations: ['contacts', 'orderDeadlines'],
    });
  }

  // private formatVendor(vendor: Vendor) {
  //   return this.sanitizeEntity({
  //     ...vendor,
  //     contacts: (vendor.contacts ?? []).map((contact) => ({
  //       id: contact.id,
  //       name: contact.name,
  //       phone_number: contact.phoneNumber,
  //       email: contact.email,
  //       is_primary: contact.isPrimary,
  //     })),
  //     order_deadlines: (vendor.orderDeadlines ?? []).map((deadline) => ({
  //       id: deadline.id,
  //       day: deadline.day,
  //     })),
  //   });
  // }
  private formatVendor(vendor: Vendor) {
    const {
      contacts,
      orderDeadlines,
      phoneNumber,
      countryId,
      stateId,
      paymentMethods,
      minOrder,
      createdAt,
      updatedAt,
      ...rest
    } = vendor;

    return this.sanitizeEntity({
      ...rest,
      phone_number: phoneNumber,
      country_id: countryId,
      state_id: stateId,
      payment_methods: paymentMethods,
      min_order: minOrder,
      created_at: createdAt,
      updated_at: updatedAt,
      contacts: (contacts ?? []).map((contact) => ({
        id: contact.id,
        name: contact.name,
        phone_number: contact.phoneNumber,
        email: contact.email,
        is_primary: contact.isPrimary,
      })),
      order_deadlines: (orderDeadlines ?? []).map((deadline) => ({
        id: deadline.id,
        day: deadline.day,
      })),
    });
  }

  async create(req: any, dto: CreateVendorDto): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const name = dto.name.trim();
      const existing = await this.findByName(repo, name);
      if (existing) {
        throw new BadRequestException('A vendor with this name already exists.');
      }

      const entity = repo.create({
        name,
        address: dto.address ?? null,
        city: dto.city ?? null,
        countryId: dto.country_id ?? null,
        stateId: dto.state_id ?? null,
        phoneNumber: dto.phone_number ?? null,
        email: dto.email ?? null,
        website: dto.website ?? null,
        username: dto.username ?? null,
        password: dto.password ?? null,
        minOrder: dto.min_order ?? null,
        paymentMethods: this.normalizePaymentMethods(dto),
        instructions: dto.instructions ?? null,
        contacts: this.buildContacts(dto),
        orderDeadlines: this.buildOrderDeadlines(dto),
      });

      const saved = await repo.save(entity);
      const hydrated = await this.loadVendor(repo, saved.id);

      return {
        success: true,
        message: 'Record created successfully',
        tenant: req.tenantConnection.options.database,
        data: hydrated ? this.formatVendor(hydrated) : null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Vendor create failed:', error);
      throw new InternalServerErrorException('Failed to create vendor');
    }
  }

  async update(req: any, id: number, dto: UpdateVendorDto): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const existing = await this.loadVendor(repo, id);

      if (!existing) {
        throw new NotFoundException(`Record with ID ${id} not found`);
      }

      if (dto.name !== undefined) {
        const name = dto.name.trim();
        if (name !== existing.name) {
          const duplicate = await this.findByName(repo, name);
          if (duplicate && duplicate.id !== id) {
            throw new BadRequestException('A vendor with this name already exists.');
          }
        }
        existing.name = name;
      }

      if (dto.address !== undefined) existing.address = dto.address;
      if (dto.city !== undefined) existing.city = dto.city;
      if (dto.country_id !== undefined) existing.countryId = dto.country_id;
      if (dto.state_id !== undefined) existing.stateId = dto.state_id;
      if (dto.phone_number !== undefined) existing.phoneNumber = dto.phone_number;
      if (dto.email !== undefined) existing.email = dto.email;
      if (dto.website !== undefined) existing.website = dto.website;
      if (dto.username !== undefined) existing.username = dto.username;
      if (dto.password !== undefined) existing.password = dto.password;
      if (dto.min_order !== undefined) existing.minOrder = dto.min_order;
      if (dto.instructions !== undefined) existing.instructions = dto.instructions;

      if (
        dto.payment_cod !== undefined ||
        dto.payment_eft !== undefined ||
        dto.payment_methods !== undefined
      ) {
        existing.paymentMethods = this.normalizePaymentMethods({
          payment_cod: dto.payment_cod ?? existing.paymentMethods?.includes(VendorPaymentMethod.COD),
          payment_eft: dto.payment_eft ?? existing.paymentMethods?.includes(VendorPaymentMethod.EFT),
          payment_methods: dto.payment_methods,
        });
      }

      if (
        dto.contacts !== undefined ||
        dto.contact_person !== undefined ||
        dto.contact_phone !== undefined ||
        dto.contact_email !== undefined
      ) {
        existing.contacts = this.buildContacts(dto);
      }

      if (dto.order_deadlines !== undefined || dto.order_deadline_days !== undefined) {
        const deadlineRepo = repo.manager.getRepository(VendorOrderDeadline);
        await deadlineRepo.delete({
          vendor: { id },
        });
        existing.orderDeadlines = this.buildOrderDeadlines(dto);
      }

      const saved = await repo.save(existing);
      const hydrated = await this.loadVendor(repo, saved.id);

      return {
        success: true,
        message: 'Record updated successfully',
        tenant: req.tenantConnection.options.database,
        data: hydrated ? this.formatVendor(hydrated) : null,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      console.error('Vendor update failed:', error);
      throw new InternalServerErrorException('Failed to update vendor');
    }
  }

  async search(req: any, query: string, limit = 15): Promise<any> {
    try {
      const vendorRepo = this.getRepo(req);
      const keyword = (query || '').trim();
      const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);

      if (!keyword) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const vendors = await vendorRepo
        .createQueryBuilder('vendor')
        .leftJoinAndSelect('vendor.contacts', 'contact')
        .where('vendor.name ILIKE :keyword', {keyword: `%${keyword}%`})
        // .orWhere('vendor.email ILIKE :keyword', {keyword: `%${keyword}%`})
        // .orWhere('vendor.phoneNumber ILIKE :keyword', {keyword: `%${keyword}%`})
        // .orWhere('contact.name ILIKE :keyword', {keyword: `%${keyword}%`})
        // .orWhere('contact.email ILIKE :keyword', {keyword: `%${keyword}%`})
        // .orWhere('contact.phoneNumber ILIKE :keyword', {keyword: `%${keyword}%`})
        .orderBy('vendor.name', 'ASC')
        .distinct(true)
        .take(take)
        .getMany();

      const data = vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        phone_number: vendor.phoneNumber,
        city: vendor.city,
        country_id: vendor.countryId,
        state_id: vendor.stateId,
        payment_methods: vendor.paymentMethods ?? [],
        contacts: (vendor.contacts ?? []).map((contact) => ({
          id: contact.id,
          name: contact.name,
          phone_number: contact.phoneNumber,
          email: contact.email,
          is_primary: contact.isPrimary,
        })),
      }));

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Vendor search failed:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      throw new InternalServerErrorException(`Failed to search vendors: ${err.message}`);
    }
  }

  async findAll(req: any): Promise<any> {
    const response = await super.findAll(req, ['contacts', 'orderDeadlines']);
    return {
      ...response,
      data: response.data.map((vendor) => this.formatVendor(vendor)),
    };
  }

  async findOne(req: any, id: number): Promise<any> {
    const response = await super.findOne(req, id, ['contacts', 'orderDeadlines']);
    return {
      ...response,
      data: this.formatVendor(response.data),
    };
  }
}
