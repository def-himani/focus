using Microsoft.EntityFrameworkCore;

namespace Focus.Api.Data;

public sealed class FocusDbContext(DbContextOptions<FocusDbContext> options) : DbContext(options)
{
}
